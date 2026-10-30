/** Motion compensation samples ONE pose at every instant. No temporal crossfade. */
export function motionSample(state) {
  const forward = state.mix < .5;
  return {
    source: forward ? state.index : state.next,
    field: state.index * 2 + (forward ? 0 : 1),
    amount: forward ? state.mix : 1 - state.mix,
  };
}

function compile(gl, type, code) {
  const shader = gl.createShader(type); gl.shaderSource(shader, code); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export function createMotionRenderer(canvas, placement) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, `
    attribute vec2 position; varying vec2 uv; uniform vec2 fit; uniform vec2 offset;
    void main(){ uv=(position+1.0)*0.5; gl_Position=vec4(position*fit+offset,0.0,1.0); }
  `);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 uv; uniform sampler2D pose; uniform sampler2D motion;
    uniform float amount; uniform float rangeOverGrid;
    vec2 velocity(vec2 at) {
      vec2 v=(texture2D(motion,clamp(at,0.0,1.0)).rg*255.0-128.0)/127.0*rangeOverGrid;
      return vec2(v.x,-v.y);
    }
    void main() {
      vec2 at=uv;
      // Invert the source-to-target displacement. Iteration follows curved limbs.
      for(int i=0;i<4;i++) at=uv-amount*velocity(at);
      if(at.x<0.0||at.y<0.0||at.x>1.0||at.y>1.0) gl_FragColor=vec4(0.0);
      else gl_FragColor=texture2D(pose,at);
    }
  `);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const attribute = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const textures = ['pose', 'motion'].map((name, index) => {
    const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, name), index); return texture;
  });
  const uniforms = Object.fromEntries(['fit', 'offset', 'amount', 'rangeOverGrid'].map(name => [name, gl.getUniformLocation(program, name)]));
  // Canvas staging preserves flip and premultiplied-alpha semantics for ImageBitmap.
  const staging = document.createElement('canvas'), ctx = staging.getContext('2d');
  let uploadedSource = -1, uploadedField = -1, previousAsset;
  function upload(index) {
    gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, textures[index]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, index === 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, staging);
  }
  return {
    kind: 'webgl-single-pose-motion',
    draw(asset, state, padding) {
      if (gl.isContextLost()) return;
      if (previousAsset !== asset) { uploadedSource = uploadedField = -1; previousAsset = asset; }
      const sample = motionSample(state), map = asset.motion;
      if (sample.source !== uploadedSource) {
        staging.width = asset.width; staging.height = asset.height;
        ctx.clearRect(0, 0, staging.width, staging.height); ctx.drawImage(asset.frames[sample.source], 0, 0); upload(0);
        uploadedSource = sample.source;
      }
      if (sample.field !== uploadedField) {
        staging.width = staging.height = map.gridSize;
        ctx.drawImage(map.atlas, (sample.field % map.columns) * map.gridSize,
          Math.floor(sample.field / map.columns) * map.gridSize, map.gridSize, map.gridSize, 0, 0, map.gridSize, map.gridSize);
        upload(1); uploadedField = sample.field;
      }
      const rect = placement(asset, canvas.width, canvas.height, padding);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.fit, rect.width / canvas.width, rect.height / canvas.height);
      gl.uniform2f(uniforms.offset, (rect.x + rect.width / 2) * 2 / canvas.width - 1,
        1 - (rect.y + rect.height / 2) * 2 / canvas.height);
      gl.uniform1f(uniforms.amount, sample.amount);
      gl.uniform1f(uniforms.rangeOverGrid, map.range / map.gridSize);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      textures.forEach(texture => gl.deleteTexture(texture)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
