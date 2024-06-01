require "file_utils"
require "http/server"
require "option_parser"

host = "localhost"
port = 6003

OptionParser.parse do |parser|
  parser.on "-h", "--help", "Show help" do
    puts parser
    exit
  end
  parser.on "-h HOST", "--host=HOST", "Host to bind to, e.g. localhost" do |h|
    host = h
  end
  parser.on "-p PORT", "--port=PORT", "Port to bind to, e.g. 6003" do |p|
    port = p.to_i32
  end
end

server = HTTP::Server.new do |context|
  path = Path[FileUtils.pwd] / Path[context.request.path]
  if !path.dirname.starts_with? FileUtils.pwd
    raise "Path is not within pwd."
  end

  if context.request.path.ends_with?("jpg") || context.request.path.ends_with?("jpeg")
    context.response.content_type = "image/jpeg"
  elsif context.request.path.ends_with?("png")
    context.response.content_type = "image/png"
  elsif context.request.path.ends_with?("ico")
    context.response.content_type = "image/x-icon"
    next
  elsif context.request.path.ends_with?("css")
    context.response.content_type = "text/css; chatset=UTF-8"
  else
    context.response.content_type = "text/html"
  end

  context.response.print File.read(path)
end

address = server.bind_tcp host, port
puts "Listening on http://#{address}"
server.listen
