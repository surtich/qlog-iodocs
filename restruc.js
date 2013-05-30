var 	fs      			= require('fs'),
path       = require('path'),
clone      = require('clone'),
beautify   = require('js-beautify').js_beautify;

const ERROR = {
 noError: {
  "code": 0, 
  "msg": ""
 },
 empty: {
  "code": 1, 
  "msg": "The parameter is empty"
 },
 noExists: {
  "code": 2, 
  "msg": "The path no exists"
 },
 exists: {
  "code": 3, 
  "msg": "The path already exists"
 },
 system : {
  "code": 999, 
  "msg": "System error"
 }
}

function Restruc(config, apisConfig) {

 var self = this;
 self.config = config;
 self.apisConfig = apisConfig;

 self.skelProject = {
  "src" : {
   "test" : {},
   "lib" : {
    "package.json": ""
   }
  },
  "README.md": ""
 };
	
 self.skelApi = {
  "README.md": "",
  "app": {
   "path": {},
   "paths.js": {
    "type": "file",
    "overwrite": true
   },
   "main.js": ""
  },
  "test": {},
  "www": {
   "test": {},
   "app": {
    "init.js": "",
    "lang": {
     "en-us.js": ""
    },
    "resource": {},
    "screen": {
     "welcome.js": "",
     "welcome.html": ""
    },
    "ui": {}
   },
   "css": {},
   "js": {},
   "img": {},
   "index.html": ""
  }
 };
		
	
 var result = createDirectories();
 console.log("result", result)

 function createDirectories() {
  
  var e = ERROR.noError;
  try {
   var r = self.config.restruc;
   e = checkPath(r.dirBase);
   if (e !== ERROR.exists) {
    e.dirBase = r.dirBase;
    return e;
   } else {
    e = checkPath(r.projectName);
    if (e === ERROR.empty) {
     e.projectName = r.projectName;
     return e;
    } else {
     var basePath = path.join(r.dirBase, formatName(r.projectName));					
     e = createDir(basePath);	
     if (e === ERROR.noError) {      
      for (var apiName in self.apisConfig) {
       self.skelProject.src[apiName] = clone(self.skelApi);
       var apiDefinition = require(__dirname + '/public/data/' + apiName + '.json');
       createServerPaths(apiDefinition, self.skelProject.src[apiName]["app"], apiName);
      }
      e = createSkel(basePath, self.skelProject);
     }
     return e;
    }
   }
  } catch (err) {
   e = ERROR.system;
   e.err = err;
   return e;
  }
 }


 function createServerPaths(apiDefinition, skelApp, apiName) {
  
  skelApp[apiName + ".js"] = "";
  
  var paths = "exports.paths = [\n";
  var first = true;
  for (var i = 0; i < apiDefinition.endpoints.length; i++) {
   var endpoint = apiDefinition.endpoints[i];
   var service = formatName(endpoint.name);
   skelApp[ service + ".js"] = "";
   for (var j = 0; j < endpoint.methods.length; j++) {
    var method = endpoint.methods[j];
    if (!first) {
     paths += "\n,";
    }
    paths += "\n\t{\t'method'\t: '" + method["HTTPMethod"] + "'";
    paths +=  "\n\t,\t'path'\t\t: '" + method["URI"] + "'";
    if (method["require"]) {
     if (Object.prototype.toString.call( method["require"] ) !== '[object Array]') {
      method["require"] = [method["require"]];
     }
     paths +=  "\n\t,\t'handler'\t: [ ";
     for (var k = 0; k < method["require"].length; k++) {
      if (k !== 0) {
       paths += ", ";
      }
      paths += "require('./path/" + method["require"][k] + "')";
      var contents =  "var " + apiName + "=require('../" + apiName + "');function handler(req,res,next){";
      var condRequired = "";
      var callParams = "";      
      for (var l = 0 ; l < method.parameters.length; l++) {
       var param = method.parameters[l];
       if (param.Location === "body") {
        contents += "var " + param.Name + "= req.body." + param.Name + ";";
       } else if (!param.Location || param.Location === "query") {
        contents += "var " + param.Name + "= req.query." + param.Name + ";";
       } else if (param.Location === "pathReplace") {
        contents += "var " + param.Name + "= req.params." + param.Name + ";";
       }
       
       if (!param.Location || param.Location === "body" || param.Location === "query" || param.Location === "pathReplace") {
        if (param.Required === true || param.Required === "Y") {
         if (condRequired !== "") {
          condRequired += " || ";
         }
         condRequired += param.Name + "=== undefined";
        }
        if (method.APIMethod) {
         if (callParams !== "") {
          callParams += ", ";
         }
         callParams += param.Name;
       }
       }
      }
      
      if (method.APIMethod) {
       if (method.APIParams) {
        callParams += (callParams? ", " : "") + method.APIParams;
       }
       callParams = method.APIMethod + "(" + callParams + (callParams? ", " : "") + "function (err, data) {";
       callParams += "if ( err ) {";
       callParams += "console.log( err );";
       callParams += "res.writeHead(500);";
       callParams += "res.end();";
       callParams += "} else {";
       callParams += "res.writeHead(200);";
       callParams += "res.end( JSON.stringify(data) );";
       callParams += "\n}";
       callParams += "\n}\n);";
      }
      
      if (condRequired) {
       contents += "\n\nif ( " +condRequired + " ) {";
       contents += "res.send(400, 'Bad request');";
       contents += "\n} else {\n";
       if (method.APIMethod) {
        contents += callParams;
       }
       contents += "\n}";
      } else {
       if (method.APIMethod) {
        contents += callParams;
       }
      }
      
      contents += "\n}";
      contents += "\n\nmodule.exports = handler;";
      contents = beautify(contents , {
       "indent_size": 1, 
       "indent_with_tabs": false, 
       "preserve_newlines": true
      });
      skelApp["path"][method["require"][k]] = {
       "type": "file",
       "overwrite": "false",
       "contents": contents
      };
     }
     paths +=  " ]";		
    } else {
     paths +=  "\n\t,\t'handler'\t: require('./path/...')";
    }
    paths += "\n\t}";
    first = false;
   }
  }
  paths += "\n]";

  skelApp["paths.js"].contents = paths;
 }

 function createSkel(basePath, skel) {
  var e = ERROR.noError;

  for (var file in skel) {
   var pathFile = path.join(basePath, file);
   if (typeof skel[file] === "object" && skel[file].type !== "file") {
    e = createDir(pathFile);
    if (e !== ERROR.noError) {
     break;
    } else {
     e = createSkel(pathFile, skel[file]);
     if (e !== ERROR.noError) {
      break;
     }	
    }				
   } else {
    if (typeof skel[file] === "string") {
     createFile(pathFile, false, skel[file]);
    } else {
     createFile(pathFile, skel[file].overwrite, skel[file].contents);
    }    
   }   		
  }
  return e;
 }

 function checkPath(path) {
  if (!path) {
   return ERROR.empty;
  } else {
   if (!fs.existsSync(path)) {
    return ERROR.noExists;
   } else {
    return ERROR.exists;
   }
  }
 }

 function createDir(path) {
  var e = checkPath(path);
  if (e === ERROR.empty) {
   return e;
  } else {
   if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
   }
   return ERROR.noError;
  }
 }

 function createFile(path, overwrite, content) {
  var e = checkPath(path);
  if (e === ERROR.empty) {
   return e;
  } else {
   if (!fs.existsSync(path) || overwrite) {
    //fs.closeSync(fs.openSync(path, 'w'));
    fs.writeFileSync(path, content);
   }
   return ERROR.noError;
  }
 }
 
 function formatName(name) {
  return name.replace(" ", "_").toLowerCase();
 }
}

exports.Restruc = Restruc;