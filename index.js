// @flow
import log from 'electron-log'; // eslint-disable-line no-unused-vars
import EventEmitter from 'eventemitter3';
import debounce from 'lodash/debounce';

import History from './History';

import Brush from './Brush';
import Eraser from './Eraser';

class Articulate extends EventEmitter {
  constructor(container, options) {
    super();

    options = options || {};

    this.container = container;

    this.height = options.height || 500;
    this.width = options.width || 500;

    this.rect = {};

    this.context = null;

    this.init();
  }

  init = () => {
    // canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'articulate';
    canvas.width = this.width;
    canvas.height = this.height;
    this.container.appendChild(canvas);

    this.context = canvas.getContext('2d');

    const lineBuffer = document.createElement('canvas');
    lineBuffer.className = 'articulate lineBuffer';
    lineBuffer.width = this.width;
    lineBuffer.height = this.height;
    this.container.appendChild(lineBuffer);

    this.lineBuffer = lineBuffer.getContext('2d');

    this.tools = {
      pencil: new Brush(this, { name: 'pencil', color: 'black' }),
      blue: new Brush(this, { name: 'blue', color: '#b2dcef' }),
      eraser: new Eraser(this, { name: 'eraser' }),
    };

    this.setTool('pencil');

    setTimeout(() => {
      this.getRect();
    }, 0);

    // events
    this.subscribeEvents();

    this.history = new History(this);
  };

  subscribeEvents = () => {
    this.container.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.emit('tool:down', this.pointerPosition(event));
    });

    window.addEventListener('mousemove', (event) => {
      if (!this.tool.isActive) return;

      this.emit('tool:move', this.pointerPosition(event));
    });

    window.addEventListener('mouseup', () => {
      if (!this.tool.isActive) return;

      this.emit('tool:up');
    });

    window.addEventListener('blur', () => {
      if (!this.tool.isActive) return;

      this.emit('tool:up');
    });

    window.addEventListener(
      'resize',
      debounce(() => {
        this.getRect();
      }, 500),
    );
  };

  clear = () => {
    this.context.clearRect(0, 0, this.width, this.height);
    this.clearLineBuffer();
  };

  clearLineBuffer = (minX, minY, maxX, maxY) => {
    // default to whole canvas
    const x = minX === undefined ? 0 : minX;
    const y = minY === undefined ? 0 : minY;
    const width = maxX === undefined ? this.width : maxX - minX;
    const height = maxY === undefined ? this.height : maxY - minY;

    this.lineBuffer.clearRect(x, y, width, height);

    // erase needs the original image to subtract from
    if (this.tool.composite === 'destination-out') {
      this.lineBuffer.globalCompositeOperation = 'source-over';

      // replace the section clearRect removed
      this.lineBuffer.drawImage(
        this.context.canvas,
        x,
        y,
        width,
        height,
        x,
        y,
        width,
        height,
      );

      this.lineBuffer.globalCompositeOperation = 'destination-out';
    }
  };

  toDataURL = () => {
    return this.context.canvas.toDataURL('image/png');
  };

  loadBitmapImage = (src) => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      const composite = this.context.globalCompositeOperation;

      if (composite !== 'source-over') {
        this.context.globalCompositeOperation = 'source-over';
      }

      this.context.drawImage(img, 0, 0);

      // reset the tool, for eraser
      this.setTool(this.tool.name);

      if (composite !== 'source-over') {
        this.context.globalCompositeOperation = composite;
      }
    };

    img.onerror = () => {
      img.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    };
  };

  hydrateDrawingPath = (path) => {
    let { points, bounds } = path;

    // deserialize tool lines
    if (typeof points === 'string') {
      points = points.split('|').map((_) => _.split(','));
      points = points.map((_) => [parseFloat(_[0]), parseFloat(_[1])]);
    }

    if (typeof bounds === 'string') {
      bounds = bounds.split('|');
    }

    return {
      ...path,
      bounds,
      points,
    };
  };

  loadDrawing = (paths, historyIndex) => {
    this.history.load(paths, historyIndex);
    // this.drawPaths(paths);
  };

  drawPaths = (paths) => {
    if (!paths || !paths.length) return;

    // stash currently active tool
    const currentTool = this.tool.props();

    paths.forEach((path) => {
      path = this.hydrateDrawingPath(path);

      // validate path tool name
      if (!this.tools[path.name]) return;

      // redraw with specified tool
      this.setTool(path.name);
      this.tool.setSize(path.size);
      this.tool.setColor(path.color);

      this.tool.points = path.points;

      this.tool.draw(this.context);
      this.tool.drawReset();
    });

    // restore original tool
    this.setTool(currentTool.name);
    this.tool.setSize(currentTool.size);
    this.tool.setColor(currentTool.color);
  };

  getRect = () => {
    this.rect = this.context.canvas.getBoundingClientRect();
  };

  setTool = (tool) => {
    // validate tool exists
    if (!this.tools[tool]) return;

    // deactivate current tool
    if (this.tool) this.tool.deactivate();

    // switch tool
    this.tool = this.tools[tool];
    this.tool.activate();
  };

  setCanvasProp = (property, value) => {
    this.context[property] = value;
    this.lineBuffer[property] = value;
  };

  pointerPosition = (event) => {
    return [event.clientX - this.rect.left, event.clientY - this.rect.top];
  };
}

export default Articulate;
