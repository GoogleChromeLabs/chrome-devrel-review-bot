function filename(path) {
  return path.substring(path.lastIndexOf('/') + 1);
}

module.exports = {
  filename
}