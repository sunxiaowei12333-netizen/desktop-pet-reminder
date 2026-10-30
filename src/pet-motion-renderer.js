/** One silhouette; only verified matching interior regions may mix material. */
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
    uniform sampler2D nextPose; uniform sampler2D nextMotion;
    uniform float amount; uniform float rangeOverGrid;
    vec2 velocity(sampler2D field, vec2 at) {
      vec2 v=(texture2D(field,clamp(at,0.0,1.0)).rg*255.0-128.0)/127.0*rangeOverGrid;
      return vec2(v.x,-v.y);
    }
    vec4 warped(sampler2D frame, sampler2D field, float progress, out float confidence) {
      vec2 at=uv;
      for(int i=0;i<4;i++) at=uv-progress*velocity(field,at);
      confidence=texture2D(field,clamp(at,0.0,1.0)).b;
      if(at.x<0.0||at.y<0.0||at.x>1.0||at.y>1.0) return vec4(0.0);
      return texture2D(frame,at);
    }
    void main() {
      float confidenceA,confidenceB;
      vec4 a=warped(pose,motion,amount,confidenceA);
      vec4 b=warped(nextPose,nextMotion,1.0-amount,confidenceB);
      // Only one contour contributes coverage. No translucent duplicate paws/tail.
      vec4 solid=amount<0.5?a:b;
      // Opaque overlap is insufficient: a paw may cover an equally opaque chest.
      // Confidence masks forbid mixing details around internal edges/occlusions.
      // Interpolate material only in stable, matched regions.
      // Unlike switching source images at t=.5 this is continuous inside the body.
      float overlap=smoothstep(0.94,0.995,min(a.a,b.a))*min(confidenceA,confidenceB);
      vec3 ca=a.rgb/max(a.a,0.0001), cb=b.rgb/max(b.a,0.0001);
      vec3 material=mix(ca,cb,smoothstep(0.0,1.0,amount));
      gl_FragColor=vec4(mix(solid.rgb,material*solid.a,overlap),solid.a);
    }
  `);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const attribute = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const textures = ['pose', 'motion', 'nextPose', 'nextMotion'].map((name, index) => {
    const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, name), index); return texture;
  });
  const uniforms = Object.fromEntries(['fit', 'offset', 'amount', 'rangeOverGrid'].map(name => [name, gl.getUniformLocation(program, name)]));
  // Canvas staging preserves flip and premultiplied-alpha semantics for ImageBitmap.
  const staging = document.createElement('canvas'), ctx = staging.getContext('2d');
  let uploadedPair = -1, previousAsset;
  function upload(index) {
    gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, textures[index]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, index % 2 === 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, staging);
  }
  return {
    kind: 'webgl-occlusion-protected-motion',
    draw(asset, state, padding) {
      if (gl.isContextLost()) return;
      if (previousAsset !== asset) { uploadedPair = -1; previousAsset = asset; }
      const map = asset.motion;
      if (state.index !== uploadedPair) {
        for (let side=0;side<2;side++) {
          staging.width = asset.width; staging.height = asset.height;
          ctx.clearRect(0, 0, staging.width, staging.height);
          ctx.drawImage(asset.frames[side === 0 ? state.index : state.next], 0, 0); upload(side*2);
          const field=state.index*2+side;
          staging.width = staging.height = map.gridSize;
          ctx.drawImage(map.atlas, (field % map.columns) * map.gridSize,
            Math.floor(field / map.columns) * map.gridSize, map.gridSize, map.gridSize, 0, 0, map.gridSize, map.gridSize);
          upload(side*2+1);
        }
        uploadedPair = state.index;
      }
      const rect = placement(asset, canvas.width, canvas.height, padding);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.fit, rect.width / canvas.width, rect.height / canvas.height);
      gl.uniform2f(uniforms.offset, (rect.x + rect.width / 2) * 2 / canvas.width - 1,
        1 - (rect.y + rect.height / 2) * 2 / canvas.height);
      gl.uniform1f(uniforms.amount, state.mix);
      gl.uniform1f(uniforms.rangeOverGrid, map.range / map.gridSize);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      textures.forEach(texture => gl.deleteTexture(texture)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
