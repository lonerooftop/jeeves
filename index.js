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
  this.lut = new Image();
  this.lut.onload = function () {
    console.assert(self.lut.height === 1, "lut height");
    console.log("lut loaded");
  };
  this.lut.src = lut;

  this._initGL(width, height);
  console.assert(this.gl, "initGL failed");
  this._initShaders();
  console.assert(this.shaderProgram, "shaderProgram failed");
  this._initBuffers();
  this.gl.clearColor(0.0, 1.0, 0.0, 1.0);
  this.gl.enable(this.gl.DEPTH_TEST);
  this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.rectangleBuffer);
  this.gl.vertexAttribPointer(
      this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition"),
      this.rectangleBuffer.itemSize,
      this.gl.FLOAT,
      false, 0, 0);
  this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.rectangleBuffer.numItems);
  console.log("arrays drawn");
}

Jeeves.prototype._initGL = function (width, height) {
  this.canvas = document.createElement("canvas");
  document.body.appendChild(this.canvas);
  this.canvas.width = width;
  this.canvas.height = height;
  this.gl = this.canvas.getContext("webgl");
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

    "void main(void) {\n" +
    "    gl_FragColor = vec4(pos.x, pos.y, 0.0, 1.0);\n" +
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
      var canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 100;
      canvas.getContext("2d").drawImage(self.lut, 0, 0, 200, 100);
      resolve({url: canvas.toDataURL("image/png")});
    };
    if (self.lut.complete) {
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
