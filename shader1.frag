#ifdef GL_ES
precision mediump float;
#endif

void main() {
  // gl_FragColor is a special variable a fragment shader
  // is responsible for setting
  gl_FragColor = vec4(1.0, 0.0, 0.5, 1.0);
}
