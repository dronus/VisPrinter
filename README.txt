VisPrinter
==========

A HTML based UI for RepRaps. 

What's included?

- A server on top of slic3r and pronsole, able to slice .stl's and control a RepRap printer connected locally

- A client based on HTML, JavaScript and WebGL running in web browsers, replacing pronterface


How far is it done?

- Work in progress
- Done some successful prints


What is needed?

- A Printrun compatible RepRap style machine connected to a python capable machine
- A modern webbrowser to use (WebGl capable)


How to install?

- Place VisPrinter directory on some machine that connects to a RepRap printer
- Make sure Slic3r is placed next to it, so can be run by 'perl ../Slic3r/slic3r.pl' or adjust settings.py
- Change to the VisPrinter directory and run 'python webserver.py'
- Do not serve it via the internet by now, as there are security concerns (pronsole could be used to run abitrary commands)

How to use?

- Open a browser
- Enter the hostname of the VisPrinter machine appended with :8082. For example, if you run the browser on the same machine, that would be 'http://127.0.0.1:8082'
- You should see the VisPrinter user interface.
- Test loading by selecting an ASCII .stl file. The model should appear in the large view area.
- Test slicing, after a model is loaded, by pressing 'slice'. The model should be replaced by a visualisation of the RepRap machine movements. 


What is it good for?

- Replaces Pronterface with an alternative UI, if someone feels the need for
- A small server can be mounted to a printer to provide an UI to everyone without the need of installing pronterface and Slic3r
- This mounted server can be a small box (eg. Raspberry Pi) mounted to the printer itself. Anyone could use the printer just by the means of his browser then.
- If mounted, the server will concentrate configuration and logging for that printer.


What will happen in the future?

- Make WebGl previews optional
- Optional compact user interface for mobile devices or printer mounted touch displays
- Remotely invoke Slic3r on powerful machines. This further enhances the usability of a small server mounted to the printer.
- Progress feedback while slicing

Credits

- Based on Printrun - https://github.com/kliment/Printrun
- Uses lightgl.js - https://github.com/evanw/lightgl.js
