/**
 * Usage:
 *
 *     jeeves = new Jeeves(width, height, lut, min, max)
 *     jeeves.getHeatmap(float64array, width, height).then(function (result) {
 *       var img = new Image();
 *       img.src = result.url;
 *     });
 */

/**
 * Creates a new Jeeves object
 * @constructor
 * @param width {int} - width of the resulting heatmap
 * @param height {int} - height of the resulting heatmap
 * @param lut {string} - image url to an image of height 1, the lookup-table
 * @param min {float} - the input value for the leftmost pixel in the lut
 * @param max {float} - the input value for the rightmost pixel in the lut
 */
function Jeeves(width, height, lut, min, max) {
  var self = this;
  this._initGL(width, height);
  console.assert(this.gl, "initGL failed");
  this._initShaders();
  console.assert(this.shaderProgram, "shaderProgram failed");
  this._initBuffers();
  this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
  this.gl.enable(this.gl.DEPTH_TEST);
  this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);

  this.lut = new Image();
  this.luttexture = this.gl.createTexture();

  if (!self.gl.getExtension("OES_texture_float") ||
      !self.gl.getExtension("OES_texture_float_linear")) {
    window.alert("System will only work with support for float textures"); // eslint-disable-line no-alert
  }
  this.lut.onload = function () {
    self.lut.isLoaded = true;
    console.assert(self.lut.height === 1, "lut height");
    console.log("lut loaded");
    self.gl.bindTexture(self.gl.TEXTURE_2D, self.luttexture);
    self.gl.texImage2D(self.gl.TEXTURE_2D, 0, self.gl.RGBA, self.gl.RGBA,
       self.gl.UNSIGNED_BYTE, self.lut);
    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_S,
        self.gl.CLAMP_TO_EDGE);
    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_T,
        self.gl.CLAMP_TO_EDGE);
    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER,
        self.gl.LINEAR);
    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER,
        self.gl.NEAREST);
    self.gl.bindTexture(self.gl.TEXTURE_2D, null);
    console.log("create image");
  };
  this.lut.src = lut;

  this.min = min;
  this.max = max;
}

Jeeves.prototype._initGL = function (width, height) {
  this.canvas = document.createElement("canvas");
  this.canvas.width = width;
  this.canvas.height = height;
  this.gl = this.canvas.getContext("webgl", {preserveDrawingBuffer: true});
  this.gl.viewportWidth = this.canvas.width;
  this.gl.viewportHeight = this.canvas.height;
};

Jeeves.prototype._initShaders = function () {
  var fragmentShader = this._getFragmentShader();
  var vertexrShader = this._getVertexShader();
  this.shaderProgram = this.gl.createProgram();
  this.gl.attachShader(this.shaderProgram, vertexrShader);
  this.gl.attachShader(this.shaderProgram, fragmentShader);
  this.gl.linkProgram(this.shaderProgram);
  console.assert(this.gl.getProgramParameter(this.shaderProgram,
        this.gl.LINK_STATUS), "Could not initialise shaders");
  this.gl.useProgram(this.shaderProgram);
  this.gl.enableVertexAttribArray(this.gl.getAttribLocation(this.shaderProgram,
        "aVertexPosition"));
};

Jeeves.prototype._initBuffers = function () {
  this.rectangleBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.rectangleBuffer);
  var vertices = [
    1.0, 1.0, -1.0,
    -1.0, 1.0, -1.0,
    1.0, -1.0, -1.0,
    -1.0, -1.0, -1.0
  ];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices),
      this.gl.STATIC_DRAW);
  this.rectangleBuffer.itemSize = 3;
  this.rectangleBuffer.numItems = 4;
};



Jeeves.prototype._getVertexShader = function() {
  var SHADERCODE =
    "attribute vec3 aVertexPosition;\n" +
    "varying vec2 pos;\n" +

    "void main(void) {\n" +
    "    gl_Position = vec4(aVertexPosition, 1.0);\n" +
    "    pos = (vec2(aVertexPosition.x, -aVertexPosition.y) + 1.0) / 2.0;\n" +
    "}";
  var shader = this.gl.createShader(this.gl.VERTEX_SHADER);
  this.gl.shaderSource(shader, SHADERCODE);
  this.gl.compileShader(shader);
  console.assert(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS),
      this.gl.getShaderInfoLog(shader));
  return shader;
};

Jeeves.prototype._getFragmentShader = function() {
  var SHADERCODE =
    "precision mediump float;\n" +
    "varying vec2 pos;\n" +
    "uniform sampler2D lut;\n" +
    "uniform sampler2D heatmap;\n" +

    "void main(void) {\n" +
    "    float val = texture2D(heatmap, pos).a;" +
    "    gl_FragColor = texture2D(lut, vec2(val, .5));\n" +
    "}";
  var shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
  this.gl.shaderSource(shader, SHADERCODE);
  this.gl.compileShader(shader);
  console.assert(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS),
      this.gl.getShaderInfoLog(shader));
  return shader;
};




/**
 * Returns a promise for an object with property "url". This property contains
 * the heatmap as a data-url in base64/png format in the requested dimensions
 * @param data {Float64Array} - data of to render
 * @param width {int} - width of the input heatmap
 * @param height {int} - height of the input heatmap
 * @returns {Promise}
 */
Jeeves.prototype.getHeatmap = function (data, width, height) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var resolver = function() {
      var heatmap = self.gl.createTexture();
      self.gl.bindTexture(self.gl.TEXTURE_2D, heatmap);
      self.gl.texImage2D(self.gl.TEXTURE_2D, 0, self.gl.ALPHA, width, height,
          0, self.gl.ALPHA, self.gl.FLOAT, data);
      self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_S,
          self.gl.CLAMP_TO_EDGE);
      self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_T,
          self.gl.CLAMP_TO_EDGE);
      self.gl.texParameteri(
          self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.NEAREST);
      self.gl.texParameteri(
          self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER, self.gl.LINEAR);
      self._draw(heatmap);
      resolve({url: self.canvas.toDataURL("image/png")});
    };
    if (self.lut.isLoaded) {
      resolver();
    } else {
      var oldfunction = self.lut.onload;
      self.lut.onload = function () {
        if (oldfunction) {
          oldfunction();
        }
        resolver();
      };
    }
  });
};

Jeeves.prototype._draw = function (heatmap) {
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.rectangleBuffer);
  this.gl.vertexAttribPointer(
      this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition"),
      this.rectangleBuffer.itemSize,
      this.gl.FLOAT,
      false, 0, 0);

  this.gl.activeTexture(this.gl.TEXTURE0);
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.luttexture);
  this.gl.uniform1i(this.gl.getUniformLocation(this.shaderProgram, "lut"), 0);

  this.gl.activeTexture(this.gl.TEXTURE1);
  this.gl.bindTexture(this.gl.TEXTURE_2D, heatmap);
  this.gl.uniform1i(
      this.gl.getUniformLocation(this.shaderProgram, "heatmap"), 1);

  this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.rectangleBuffer.numItems);
  console.log("arrays drawn");
};


window.module = window.module || {};
module.exports = {Jeeves: Jeeves};
