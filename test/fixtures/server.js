import http from 'http'

export default (cb, port = 12345) => {
  const server = http.createServer(cb)

  server.listen(port)

  return server
}
