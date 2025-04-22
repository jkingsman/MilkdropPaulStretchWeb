// paulstretch-worker.js
importScripts("paulstretch.js");

var debugActivated = false;
var paulStretch;
var batchSize,
  blockSize,
  blocksOut = [];

onmessage = function (event) {
  switch (event.data.type) {
    case "init":
      // Initializing the paulstretch object
      paulStretch = new PaulStretch(
        event.data.numberOfChannels,
        5, // Default ratio
        event.data.winSize
      );

      // Initializing other settings
      batchSize = event.data.batchSize;
      blockSize = event.data.blockSize;

      // Initializing `blocksOut` to contain several blocks (arrays of Float32Array)
      // That we are going to reuse to avoid allocations
      for (var i = 0; i < batchSize; i++) {
        blocksOut.unshift([]);
        for (var ch = 0; ch < event.data.numberOfChannels; ch++)
          blocksOut[0].push(new Float32Array(blockSize));
      }

      debug("initialized " + paulStretch.toString());
      break;

    case "config":
      paulStretch.setRatio(event.data.ratio);
      debug("change config, ratio: " + event.data.ratio);
      break;

    case "read":
      var i;

      // Reads and sends `batchSize` blocks or gives up for now
      if (Math.floor(paulStretch.readQueueLength() / blockSize) >= batchSize) {
        for (i = 0; i < batchSize; i++) paulStretch.read(blocksOut[i]);
        postMessage({ type: "read", data: blocksOut });
        debug("sent " + batchSize + " blocks");
      } else {
        debug(
          "not enough blocks ready, only " +
            paulStretch.readQueueLength() +
            " samples available"
        );
      }

      // Process until we have more than `batchSize` blocks,
      // or until we don't have enough frames to process
      while (
        paulStretch.readQueueLength() < batchSize * blockSize &&
        paulStretch.process() !== 0
      ) {
        debug(
          "processed a batch, now " +
            paulStretch.readQueueLength() +
            " samples in output queue"
        );
      }
      break;

    // Just write the incoming blocks to the write queue
    case "write":
      paulStretch.write(event.data.data);
      debug(
        "wrote " +
          event.data.data[0].length +
          " samples to input queue, queue length: " +
          paulStretch.writeQueueLength()
      );

      // Process immediately after writing to reduce latency
      while (paulStretch.process() !== 0) {
        debug(
          "processed batch during write, read queue: " +
            paulStretch.readQueueLength()
        );
      }
      break;
  }
};

var debug = function (msg) {
  if (debugActivated) console.log(msg);
};
