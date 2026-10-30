import { createRigMesh, deformRig } from './pet-rig.js';
export function createRigRenderer(canvas, placement) {
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:false,stencil:false});
  if(!gl)return null;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  const vs=shader(gl.VERTEX_SHADER,`attribute vec2 position;attribute vec2 texcoord;varying vec2 uv;uniform vec2 resolution;uniform vec4 rect;void main(){uv=texcoord;vec2 p=rect.xy+position/448.0*rect.zw;gl_Position=vec4(p/resolution*vec2(2.0,-2.0)+vec2(-1.0,1.0),0.0,1.0);}`);
  const fs=shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 uv;uniform sampler2D fur;void main(){gl_FragColor=texture2D(fur,uv);}`);
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);const buffers=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()],texture=gl.createTexture();
  const pos=gl.getAttribLocation(program,'position'),tex=gl.getAttribLocation(program,'texcoord');
  const res=gl.getUniformLocation(program,'resolution'),rectUniform=gl.getUniformLocation(program,'rect');
  let mesh,previous,uploads=0;
  return {kind:'webgl-fixed-texture-rig',getStats(){return {textureUploads:uploads,sourceTextures:1};},
    draw(asset,state,padding){
      if(gl.isContextLost())return;
      if(previous!==asset){
        previous=asset;mesh=createRigMesh(asset.rig.id);
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[1]);gl.bufferData(gl.ARRAY_BUFFER,mesh.uv,gl.STATIC_DRAW);gl.enableVertexAttribArray(tex);gl.vertexAttribPointer(tex,2,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffers[2]);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        const staging=document.createElement('canvas');staging.width=asset.width;staging.height=asset.height;staging.getContext('2d').drawImage(asset.frames[0],0,0);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,staging);gl.uniform1i(gl.getUniformLocation(program,'fur'),0);uploads++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,buffers[0]);gl.bufferData(gl.ARRAY_BUFFER,deformRig(mesh,state.mix),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const r=placement(asset,canvas.width,canvas.height,padding);gl.uniform2f(res,canvas.width,canvas.height);gl.uniform4f(rectUniform,r.x,r.y,r.width,r.height);
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
    },destroy(){buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteTexture(texture);gl.deleteProgram(program);gl.clear(gl.COLOR_BUFFER_BIT);}
  };
}
