function getCookieValue(cookieName)
{
 var value=null;
 if(document.cookie != "") 
 {
  cookieName=cookieName+"=";
  
  var start=document.cookie.indexOf(cookieName);
  if(start>=0) 
  {
   start=start+cookieName.length;
   
   var end=document.cookie.indexOf(";", start);
   if(end<0) end=document.cookie.length;
   
   value=document.cookie.substring(start,end);
   value=unescape(value);
  }
 }
 return value;
}

function setCookie(cookieName,cookieValue)
{
 var cookie=cookieName+"="+escape(cookieValue)+";";
 document.cookie=cookie;
}
/*
if(HTMLElement){
	HTMLElement.prototype.removeClass=function(className){
		var tmp=" "+this.className+" ";
		tmp=tmp.replace(" "+className+" "," ");
		tmp=tmp.trim();
		this.className=tmp;
	}
}*/

clone=function(object){
	return JSON.parse(JSON.stringify(object));
}

