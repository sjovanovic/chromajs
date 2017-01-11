/*
  Chroma js adds chroma key to images.


  Author: Slobodan Jovanovic
  Website: https://github.com/sjovanovic

  It replaces img element with a WebGL canvas showing the same image but with one color transparent

  Usage:

      new Chroma(imgElement); // Chroma key of a single image. Chroma color is white

  or
  
    new Chroma(imgElement, {
      chroma:[0.99, 0.99, 0.99], // this is red, green, blue channel for the chroma key color that is going to be transparent
      tolerance: 0.05 // tolerance around chroma values, less is more strict
    })

  or for multiple images

    var chroma = new Chroma({
      chroma:[0.99, 0.99, 0.99],
      tolerance: 0.05
    })
    chroma.chromaKey(imgElement)  // image 1
    chroma.chromaKey(imgElement2) // image 2 ...

*/
function Chroma(elem, options){
  var inst = this

  inst.image = null;
  if(elem && elem instanceof HTMLImageElement){
    inst.image = elem;
  }else if(elem && elem instanceof Object){
    options = elem;
  }
  // default options
  inst.options = {
    chroma:[0.99, 0.99, 0.99],
    tolerance:0.05
  }
  // merge options
  if(options){
    for(var i in options){
      inst.options[i] = options[i]
    }
  }

  inst.init = function(){
    // create a hidden canvas
    inst.canvas = document.createElement('canvas');
    inst.canvas.setAttribute('crossOrigin','anonymous');
    inst.canvas.style.display = 'none';
    document.getElementsByTagName('body')[0].appendChild(inst.canvas);
    // init program
    inst.initProgram();
  }


  inst.chromaKey = function(image){
    inst.image = image;
    var gl = inst.gl;
    inst.whenImgLoaded(function(){

      // canvas of the same size as image
      inst.canvas.width = inst.image.width;
      inst.canvas.height = inst.image.height;

      // Create a texture and put the image in it.
      inst.originalImageTexture = inst.createAndSetupTexture(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inst.image);

      // set the size of the image
      gl.uniform2f(inst.textureSizeLocation, inst.image.width, inst.image.height);

      // null is for canvas
      inst.setFramebuffer(null, inst.canvas.width, inst.canvas.height);

      // and rectangle
      inst.setRectangle( gl, 0, 0, inst.image.width, inst.image.height);

      // draw it
      inst.draw();

      // replace image with the result
      inst.image.src = inst.canvas.toDataURL();
    })
  }

  inst.whenImgLoaded = function(cb){
    if(inst.image.complete || inst.image.naturalHeight !== 0){
      cb()
    }else{
      //inst.image.onload = cb
      inst.image.addEventListener('load', cb, {once:true, capture:true})
    }
  }

  inst.initProgram = function(){
    var inst = this;
    // Get A WebGL context
    var canvas = inst.canvas;
    var gl = inst.getWebGLContext(canvas);
    inst.gl = gl;
    if (!gl) {return;}

    // Shaders
    var vshader = "attribute vec2 a_position; \n\
    attribute vec2 a_texCoord; \n\
    uniform vec2 u_resolution; \n\
    uniform float u_flipY; \n\
    varying vec2 v_texCoord; \n\
    void main() { \n\
       vec2 zeroToOne = a_position / u_resolution; \n\
       vec2 zeroToTwo = zeroToOne * 2.0; \n\
       vec2 clipSpace = zeroToTwo - 1.0; \n\
       gl_Position = vec4(clipSpace * vec2(1, u_flipY), 0, 1); \n\
       v_texCoord = a_texCoord; \n\
    }";

    var fshader = "precision mediump float; \n\
    uniform sampler2D u_image; \n\
    uniform vec2 u_textureSize; \n\
    varying vec2 v_texCoord; \n\
    uniform vec3 chroma; \n\
    uniform float tolerance; \n\
    void main() { \n\
      //vec2 onePixel = vec2(1.0, 1.0) / u_textureSize; \n\
      vec4 color = texture2D(u_image, v_texCoord); \n\
      if((color.r <= chroma.r - tolerance || color.r >= chroma.r + tolerance) && (color.g <= chroma.g - tolerance || color.g >= chroma.g + tolerance) && (color.b <= chroma.b - tolerance || color.b >= chroma.b + tolerance)){ \n\
        gl_FragColor = color; \n\
      }else{ \n\
        discard; \n\
      } \n\
    }";

    var program = inst.createProgram(gl, vshader, fshader)
    inst.program = program;
    gl.useProgram(program);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");
    var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

    // provide texture coordinates for the rectangle.
    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // lookup uniforms
    var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    inst.resolutionLocation = resolutionLocation;
    var textureSizeLocation = gl.getUniformLocation(program, "u_textureSize");
    inst.textureSizeLocation = textureSizeLocation;

    var flipYLocation = gl.getUniformLocation(program, "u_flipY");
    inst.flipYLocation = flipYLocation;

    // Create a buffer for the position of the rectangle corners.
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // flip is -1 for canvas 1 for framebuffer
    gl.uniform1f(inst.flipYLocation, -1);

  }

  inst.createAndSetupTexture = function(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  }

  inst.setRectangle = function(gl, x, y, width, height) {
    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       x1, y1,
       x2, y1,
       x1, y2,
       x1, y2,
       x2, y1,
       x2, y2]), gl.STATIC_DRAW);
  }

  inst.setFramebuffer = function(fbo, width, height) {
    var gl = inst.gl;
    // make this the framebuffer we are rendering to.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Tell the shader the resolution of the framebuffer.
    gl.uniform2f(inst.resolutionLocation, width, height);

    // Tell webgl the viewport setting needed for framebuffer.
    gl.viewport(0, 0, width, height);
  }

  inst.draw = function(){
    var gl = inst.gl;

    gl.uniform1f(gl.getUniformLocation(inst.program, "tolerance"), parseFloat(inst.options.tolerance));
    gl.uniform3f(gl.getUniformLocation(inst.program, "chroma"), inst.options.chroma[0], inst.options.chroma[1], inst.options.chroma[2]);

    //gl.bindTexture(gl.TEXTURE_2D, inst.originalImageTexture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  inst.loadShader = function(gl, shaderSource, shaderType) {    
    // Create the shader object
    var shader = gl.createShader(shaderType);

    // Load the shader source
    gl.shaderSource(shader, shaderSource);

    // Compile the shader
    gl.compileShader(shader);

    // Check the compile status
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      var lastError = gl.getShaderInfoLog(shader);
      console.log("*** Error compiling shader '" + shader + "':" + lastError);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  inst.createProgram = function(gl, vertexShader, fragmentShader){
    var program = gl.createProgram();
    
    gl.attachShader(program, inst.loadShader(gl, vertexShader, gl.VERTEX_SHADER));
    gl.attachShader(program, inst.loadShader(gl, fragmentShader, gl.FRAGMENT_SHADER));
    
    gl.linkProgram(program);

    // Check the link status
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        // something went wrong with the link
        var lastError = gl.getProgramInfoLog(program);
        console.log("Error in program linking:" + lastError);

        gl.deleteProgram(program);
        return null;
    }
    return program;
  }

  inst.getWebGLContext = function(canvas, opt_attribs){
    var names = ["experimental-webgl2", "webgl", "experimental-webgl"];
    var context = null;
    for (var ii = 0; ii < names.length; ++ii) {
      try {
        if(opt_attribs){
          opt_attribs.preserveDrawingBuffer = true;
        }else{
          opt_attribs = {preserveDrawingBuffer:true};
        }
        context = canvas.getContext(names[ii], opt_attribs);
      } catch(e) {}  // eslint-disable-line
      if (context) {
        break;
      }
    }
    return context;
  }

  inst.setTexture = function(textureId, unitId, samplerName){
    var gl = inst.gl;
    // lookup the sampler locations.
    if(!inst.uniLocMap){inst.uniLocMap = {}}
    var locId = textureId+unitId+samplerName;
    inst.uniLocMap[locId] = gl.getUniformLocation(inst.program, samplerName);
    
    // set which texture units to render with.
    gl.uniform1i(inst.uniLocMap[locId], unitId);  // texture unit

    // Set each texture unit to use a particular texture.
    gl.activeTexture(gl.TEXTURE0 + unitId);
    gl.bindTexture(gl.TEXTURE_2D, inst.textures[textureId]);
    gl.activeTexture(gl.TEXTURE0);
  }

  // start up
  inst.init();
  if(inst.image){
    inst.chromaKey(inst.image)
  }
  
}