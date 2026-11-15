/* Use the inspected Linux image's local time inside application frames. */
(function () {
  "use strict";
  if(!window.OSOmniDevice || !['linux','android','windows'].includes(OSOmniDevice.platform) || !['Asia/Hong_Kong','Etc/UTC','UTC','America/Los_Angeles'].includes(OSOmniDevice.timezone))return;
  var NativeDate=window.Date,NativeFormatter=Intl.DateTimeFormat,offset=OSOmniDevice.timezone==='Asia/Hong_Kong'?8*3600000:0,zone=OSOmniDevice.timezone;
  var zoneFormatter=new NativeFormatter('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'});
  function offsetAt(time){if(zone!=='America/Los_Angeles')return offset;if(!Number.isFinite(time))return NaN;var parts={};zoneFormatter.formatToParts(new NativeDate(time)).forEach(function(p){parts[p.type]=p.value;});return NativeDate.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Math.floor(time/1000)*1000;}
  function fromWall(time){var first=time-offsetAt(time),second=time-offsetAt(first);return offsetAt(second)===offsetAt(first)?second:Math.max(first,second);}
  function localInstant(value){var d=new NativeDate(value);if(!Number.isFinite(d.getTime()))return NaN;return fromWall(NativeDate.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()));}
  function parse(value){var text=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(text)||/[zZ]$/.test(text)||/GMT|UTC/i.test(text)||/[T ]\d{2}:\d{2}.*[+-]\d{2}(?::?\d{2})?$/.test(text))return NativeDate.parse(text);return localInstant(text);}
  function DeviceDate(){
    var args=Array.from(arguments);
    if(!new.target)return new DeviceDate().toString();
    if(args.length>1)args=[fromWall(NativeDate.UTC.apply(NativeDate,args))];
    else if(args.length===1&&typeof args[0]==='string')args=[parse(args[0])];
    return Reflect.construct(NativeDate,args,new.target);
  }
  Object.setPrototypeOf(DeviceDate,NativeDate);DeviceDate.prototype=Object.create(NativeDate.prototype);Object.defineProperty(DeviceDate.prototype,'constructor',{value:DeviceDate});DeviceDate.parse=parse;
  ['FullYear','Month','Date','Day','Hours','Minutes','Seconds','Milliseconds'].forEach(function(part){DeviceDate.prototype['get'+part]=function(){return new NativeDate(this.getTime()+offsetAt(this.getTime()))['getUTC'+part]();};});
  ['FullYear','Month','Date','Hours','Minutes','Seconds','Milliseconds'].forEach(function(part){DeviceDate.prototype['set'+part]=function(){var d=new NativeDate(this.getTime()+offsetAt(this.getTime()));d['setUTC'+part].apply(d,arguments);return NativeDate.prototype.setTime.call(this,fromWall(d.getTime()));};});
  DeviceDate.prototype.getTimezoneOffset=function(){return Number.isFinite(this.getTime())?-offsetAt(this.getTime())/60000:NaN;};DeviceDate.prototype.getYear=function(){return this.getFullYear()-1900;};DeviceDate.prototype.setYear=function(y){y=Number(y);return this.setFullYear(y>=0&&y<=99?1900+y:y);};
  ['toLocaleString','toLocaleDateString','toLocaleTimeString'].forEach(function(method){DeviceDate.prototype[method]=function(locales,options){return NativeDate.prototype[method].call(this,locales||'en-US',Object.assign({timeZone:zone},options||{}));};});
  DeviceDate.prototype.toDateString=function(){if(!Number.isFinite(this.getTime()))return 'Invalid Date';return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][this.getDay()]+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][this.getMonth()]+' '+String(this.getDate()).padStart(2,'0')+' '+this.getFullYear();};
  DeviceDate.prototype.toTimeString=function(){if(!Number.isFinite(this.getTime()))return 'Invalid Date';var minutes=offsetAt(this.getTime())/60000,sign=minutes<0?'-':'+';return [this.getHours(),this.getMinutes(),this.getSeconds()].map(function(n){return String(n).padStart(2,'0');}).join(':')+' GMT'+sign+String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')+String(Math.abs(minutes)%60).padStart(2,'0')+' ('+zone+')';};DeviceDate.prototype.toString=function(){return Number.isFinite(this.getTime())?this.toDateString()+' '+this.toTimeString():'Invalid Date';};
  window.Date=DeviceDate;
  function DeviceFormatter(locales,options){return new NativeFormatter(locales&&(!Array.isArray(locales)||locales.length)?locales:'en-US',Object.assign({timeZone:zone},options||{}));}
  Object.setPrototypeOf(DeviceFormatter,NativeFormatter);DeviceFormatter.prototype=NativeFormatter.prototype;Intl.DateTimeFormat=DeviceFormatter;
})();
