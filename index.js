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
 * @param lutURL {string} - image url to an image of height 1, the lookup-table
 * @param lutResolution {string} - The number of buckets generated from the lut
 * @param min {float} - the input value for the leftmost pixel in the lut
 * @param max {float} - the input value for the rightmost pixel in the lut
 */
function Jeeves(width, height, lutURL, lutResolution, min, max) {
  var self = this;
  self.width = width;
  self.height = height;
  self.min = min;
  self.max = max;
  self.lutResolution = lutResolution;
  self.lutURL = lutURL;
}

/**
 * Returns a promose which fulfills when inited
 * @returns {Promise}
 */
Jeeves.prototype.init = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.inited = true;
    var lutImage = new Image();

    lutImage.onload = function () {
      console.assert(lutImage.height === 1, "lut height");
      var canvas = document.createElement("canvas");
      canvas.height = lutImage.height;
      canvas.width = lutImage.width;
      var context = canvas.getContext("2d");
      context.drawImage(lutImage, 0, 0, canvas.width, canvas.height);
      var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      var lutData = new Uint8ClampedArray(self.lutResolution * 4);
      var i, c, pos, upper, lower, f;
      for (i = 0; i < self.lutResolution; i++) {
        pos = i / (self.lutResolution - 1) * (lutImage.width - 1);
        lower = Math.floor(pos);
        upper = Math.ceil(pos);
        f = pos - lower;
        for (c = 0; c < 4; c++) {
          lutData[i * 4 + c] = (1 - f) * imageData.data[lower * 4 + c] +
            f * (imageData.data[upper * 4 + c]);
        }
      }
      self.lut = new Uint32Array(lutData.buffer); // one pixel per element
      resolve("ok");
    };
    lutImage.src = self.lutURL;
  });
};

/**
 * Returns a promise for an object with property "url". This property contains
 * the heatmap as a data-url in base64/png format in the requested dimensions
 * @param data {Float64Array} - data of to render
 * @param dataWidth {int} - width of the input heatmap
 * @param dataHeight {int} - height of the input heatmap
 * @returns {string} - URL to PNG image
 */
Jeeves.prototype.getHeatmap = function (data, dataWidth, dataHeight) {
  console.time("getHeatmap");
  var hmCorrectWidth = new Float64Array(this.width * dataHeight);
  var x, y, val, lower, upper, f;
  for (x = 0; x < this.width; x++) {
    val = (x + 0.5) / this.width * dataWidth - 0.5;
    lower = Math.max(0, Math.floor(val));
    upper = Math.min(dataWidth - 1, Math.ceil(val));
    f = val - lower;
    for (y = 0; y < dataHeight; y++) {
      hmCorrectWidth[x + y * this.width] = data[lower + y * dataWidth] +
        f * (data[upper + y * dataWidth] - data[lower + y * dataWidth]);
    }
  }
  var hmFullLutted = new Uint32Array(this.width * this.height);
  var floatval, index;
  for (y = 0; y < this.height; y++) {
    val = (y + 0.5) / this.height * dataHeight - 0.5;
    lower = Math.max(0, Math.floor(val));
    upper = Math.min(dataHeight - 1, Math.ceil(val));
    f = val - lower;
    for (x = 0; x < this.width; x++) {
      floatval = hmCorrectWidth[x + lower * this.width] +
        f * (hmCorrectWidth[x + upper * this.width] -
            hmCorrectWidth[x + lower * this.width]);
      index = Math.max(0,
          Math.min(this.lutResolution - 1,
            Math.round(((floatval - this.min) / (this.max - this.min)) *
              (this.lutResolution - 1))));
      hmFullLutted[x + y * this.width] = this.lut[index];
    }
  }
  var pixels = new Uint8ClampedArray(hmFullLutted.buffer);
  var canvas = document.createElement("canvas");
  canvas.width = this.width;
  canvas.height = this.height;
  var context = canvas.getContext("2d");
  var imagedata = context.createImageData(this.width, this.height);
  imagedata.data.set(pixels);
  context.putImageData(imagedata, 0, 0);
  var pngURL = canvas.toDataURL("image/png");
  console.timeEnd("getHeatmap");
  return pngURL;
};


window.module = window.module || {};
module.exports = {Jeeves: Jeeves};
