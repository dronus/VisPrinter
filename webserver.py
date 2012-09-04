#!/usr/bin/python

import settings,sys,string,cgi,subprocess,random,os,Cookie,BaseHTTPServer,urlparse,glob
from SocketServer import ThreadingMixIn


recv_buffer=[]
def recv_printer(line):
    global recv_buffer
    print "OUTPUT:",line
    recv_buffer+=[line]

#try:
import pronsole
printer=pronsole.pronsole()
recv_buffer=[]
printer.recvlisteners+=[recv_printer]
#except Exception as e : 
#    print e
	

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


class RequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):

    def serve_printer(self):
        global recv_buffer
        self.send_response(200)
        self.end_headers()
	tmp_buffer=recv_buffer
        recv_buffer=[]
        for line in tmp_buffer:
        	self.wfile.write(line)

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
        if not "Cookie" in self.headers or self.headers.get('Cookie').find('session=')==-1:
            self.send_header('Set-Cookie','session='+str(random.randint(0,0xFFFFFFFF)));

        self.end_headers()
        #send file content
        self.wfile.write(f.read())
        f.close()

    def serve_configs(self):
        # send headers
        self.send_response(200)
        self.end_headers()
        #send file content
        for filename in glob.glob('configs/*.ini'):
            self.wfile.write(filename+"\n")
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
            elif url_parts.path=='/configs':
                self.serve_configs()            
            elif url_parts.path=='/printer':
                self.serve_printer()      
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
                upfilecontent = query.get('stl')[0]
                config        = query.get('config')[0]
            else: raise Exception("Unexpected POST request")
       
            self.send_response(200)
            self.end_headers()
            # copy POSTed stl data to .stl file
            stlFile=open('tmp/'+session+'.stl','w')
            stlFile.write(upfilecontent)
            stlFile.close()
            # invoke the slic3r
            subprocess.call(settings.slicer+' --load '+config+' -o tmp/'+session+'.gcode tmp/'+session+'.stl >tmp/'+session+'.out',shell=True)
            # pass resulting .gcode file content to client
            gcode=open('tmp/'+session+'.gcode', 'r').read()
            self.wfile.write(gcode)
            
        except Exception as e:
            print e
            self.send_error(404,'POST to "%s" failed: %s' % (self.path, str(e)) )


class ThreadingServer(ThreadingMixIn, BaseHTTPServer.HTTPServer):
    pass


if __name__ == '__main__':
    try:
        os.chdir(os.path.dirname(os.path.abspath(sys.argv[0])))
        server = ThreadingServer(('', settings.port), RequestHandler)
        print 'server running on port '+str(settings.port)
        server.serve_forever()
    except KeyboardInterrupt:
        server.socket.close()

