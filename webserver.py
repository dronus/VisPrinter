#!/usr/bin/python

import sys,string,cgi,subprocess, random, os, Cookie, BaseHTTPServer,urlparse, pronsole


port=8080

# -----------------------------------------------------------------------


# a simple stdout T-junction 
# used to forward pronsole.py outputs to the server
class Tee(object):
    def __init__(self, pipe):
        self.stdout = sys.stdout
        self.stderr = sys.stderr
        sys.stdout = self
        sys.stderr = self
        self.pipe=pipe
    def close(self):
        self.flush()
        sys.stdout = self.stdout
        sys.stderr = self.stderr
    def write(self, data):
        self.pipe  .write(data.encode("utf-8"))
        self.stdout.write(data.encode("utf-8"))
    def flush(self):
        self.pipe  .flush()
        self.stdout.flush()


printer=pronsole.pronsole()

class RequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):

    def serve_file(self,url_path):
        # map URL path to file in our directory
        file_path=os.path.abspath('./'+url_path)
        
        # prevent the client from accessing any file outside our directory
        server_path=os.path.abspath('.')
        if not file_path.startswith(server_path):
            raise Exception("Illegal path: "+path)
                    
        # open the file to serve
        f = open(file_path)

        # send headers
        self.send_response(200)
    #    self.send_header('Content-type',	'text/html')
        # establish a random session cookie 
        if not "Cookie" in self.headers:
            self.send_header('Set-Cookie','session='+str(random.randint(0,0xFFFFFFFF)));

        self.end_headers()
        #send file content
        self.wfile.write(f.read())
        f.close()

    # issue command via pronsole.py and return result       
    def serve_pronsole(self,cmd):
        self.send_response(200)
        self.end_headers()
        # install stdout T-junction to pass pronsole's 'print' output to the client
        tee=Tee(self.wfile)
        # issue command
        try:
            printer.onecmd(cmd)
        except Exception as e:
            print e
        tee.close()

    def do_GET(self):
        try:
            # split URL parts (path, querystring)
            url_parts =urlparse.urlparse(self.path)
            # extract query sting parameters:
            url_params=urlparse.parse_qs(url_parts.query) 

            if url_parts.path=='/pronsole':
                self.serve_pronsole(url_params.get('cmd')[0])
            else:
                self.serve_file(url_parts.path)
        except IOError as e :  
            print e
            self.send_error(404,'File Not Found: %s' % self.path)

    def do_POST(self):

        try:
            # analyse headers to get uploaded content and cookies        
            ctype, pdict = cgi.parse_header(self.headers.getheader('content-type'))     

            # read session cookie            
            if "Cookie" in self.headers:
                c = Cookie.SimpleCookie(self.headers["Cookie"])
                session=c['session'].value
                # make sure session is a number
                session=str(int(session))
            else: raise Exception("No session cookie")

            # extract POSTed stl data                
            if ctype == 'multipart/form-data' : 
                query=cgi.parse_multipart(self.rfile, pdict)
                upfilecontent = query.get('stl')
            else: raise Exception("Unexpected POST request")
       
            self.send_response(200)
            self.end_headers()
            # copy POSTed stl data to .stl file
            stlFile=open(session+'.stl','w')
            stlFile.write(upfilecontent[0])
            stlFile.close()
            # involke the slic3r
            subprocess.call('perl ../Slic3r/slic3r.pl -o '+session+'.gcode '+session+'.stl >'+session+'.out',shell=True,stdout=self.wfile)
            # pass resulting .gcode file content to client
            gcode=open(session+'.gcode', 'r').read()
            self.wfile.write(gcode)
            
        except Exception as e:
            # pass
            print e
            self.send_error(404,'POST to "%s" failed: %s' % (self.path, str(e)) )


if __name__ == '__main__':
    try:
        server = BaseHTTPServer.HTTPServer(('', port), RequestHandler)
        print 'server running on port '+str(port)
        server.serve_forever()
    except KeyboardInterrupt:
        server.socket.close()

