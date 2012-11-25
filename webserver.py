#!/usr/bin/python

import settings,sys,string,cgi,subprocess,random,os,Cookie,BaseHTTPServer,urlparse,glob,traceback,re,thread
from SocketServer import ThreadingMixIn
import pronsole
printer=pronsole.pronsole()
recv_buffer=[]
def recv_printer(line):
    global recv_buffer
    print "OUTPUT:",line
    recv_buffer+=[line]
printer.recvlisteners+=[recv_printer]
progress=0
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

    # issue command via pronsole.py and return result       
    def serve_pronsole(self,cmd):
        self.send_response(200)
        self.end_headers()
        # install stdout T-junction to pass pronsole's 'print' output to the client
        #tee=Tee(self.wfile)
        # issue command
        try:
            printer.onecmd(cmd)
        except Exception as e:
            print e
        #tee.close()

    def serve_slic3r(self,session_id,config):
        self.send_response(200)
        self.end_headers()
        # invoke the slic3r with progress indicator
	self.call_monitored(settings.slicer+' --debug --load '+config+' -o tmp/'+session_id+'.gcode tmp/'+session_id+'.stl',self.monitor_slic3r)	
	# pass resulting .gcode file content to client
	gcode=open('tmp/'+session_id+'.gcode', 'r').read()
	self.wfile.write(gcode)

    def serve_progress(self,session_id):
        self.send_response(200)
        self.end_headers()
	self.wfile.write(str(progress))
 
    def monitor_slic3r(self,line):
        global progress
        match=re.match('Making surfaces for layer ([0-9]+)',line)
        if match:
            self.slic3r_layers=int(match.group(1))
        match=re.match('Filling layer ([0-9]+)',line)
        if match:
            progress=30+int(match.group(1))*70/self.slic3r_layers
            print 'Slic3r progress:',progress

    def monitor(self, fd, callback): 
	pipe=os.fdopen(fd)
	while True:
		line=pipe.readline()
		if not line: break
		callback(line)
	os.close(fd)

 
    # run a command and collect stderr, stdout to a buffer for interactive access
    # this is useful to serve a progress indicator for commands providing some progress output
    def call_monitored(self, cmdline, callback):
	global progress
	progress=0
        # create a pipe to capture stderr,stdout 
	pipeout,pipein=os.pipe()
        # child thread, collect the command's output
        thread.start_new_thread(self.monitor,(pipeout,callback))
	# main thread, run the command
	subprocess.call(cmdline,shell=True,stdout=pipein,stderr=pipein)
	os.close(pipein)

    def save_tmp(self,name,content):
       # copy content to file
       print 'Saving to ',name
       f=open(name,'w')
       f.write(content)
       f.close()
        
    def save_uploads(self, session_id):
        contenttype_header=self.headers.getheader('content-type',False)
        if not contenttype_header:
             return
        # check if contenttype is multipart, exit otherwise
        ctype, pdict = cgi.parse_header(contenttype_header) 
        if not ctype == 'multipart/form-data': 
            return            
        parts=cgi.parse_multipart(self.rfile, pdict)
        # assert valid session_id
        if not session_id:
            raise Exception("No session cookie")
        # save every uploaded file, using the session_id as prefix and the HTML field name as suffix.
        for key, contents in parts.items():
            if key.startswith('configs/'):
                filename=key
            else:
                filename='tmp/'+session_id+'.'+key;
            self.save_tmp(filename, contents[0])

    def get_session(self):
        id=False
        if "Cookie" in self.headers:
            c = Cookie.SimpleCookie(self.headers["Cookie"])
            id=c['session'].value
            # make sure session is a number
            if not id.isdigit(): 
                raise Exception('Invalid session cookie')
        return id        

    def do_GET(self):
        self.serve_request()
        
    def do_POST(self):
        self.serve_request()
        
    def serve_request(self):

        try:
            # split URL parts (path, querystring)
            url_parts =urlparse.urlparse(self.path)
            # extract query string parameters:
            url_params=urlparse.parse_qs(url_parts.query) 
            # read session cookie 
            session_id=self.get_session()
            # save all POSTed files to /tmp
            self.save_uploads(session_id)
            
            if url_parts.path=='/pronsole':
                self.serve_pronsole(url_params.get('cmd')[0])
            elif url_parts.path=='/configs':
                self.serve_configs()            
            elif url_parts.path=='/printer':
                self.serve_printer()      
            elif url_parts.path=='/slic3r':
                self.serve_slic3r(session_id,url_params.get('config')[0])
            elif url_parts.path=='/progress':
                self.serve_progress(session_id)
            elif url_parts.path=='/upload':
		self.send_response(200)
		self.end_headers()
            else:
                self.serve_file(url_parts.path)
           
        except Exception as e:
            print traceback.format_exc()
            self.send_error(404,'Request to "%s" failed: %s' % (self.path, str(e)) )

class ThreadingServer(ThreadingMixIn, BaseHTTPServer.HTTPServer):
    pass


if __name__ == '__main__':
    try:
        os.chdir(os.path.dirname(os.path.abspath(sys.argv[0])))
        server = ThreadingServer(('', settings.port), RequestHandler)
        #server = BaseHTTPServer.HTTPServer(('', settings.port), RequestHandler)
        print 'server running on port '+str(settings.port)
        server.serve_forever()
    except KeyboardInterrupt:
        server.socket.close()

