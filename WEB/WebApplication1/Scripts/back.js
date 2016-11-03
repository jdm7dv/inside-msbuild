dojo.provide("dojo.back");

/*=====
dojo.back = {
	// summary: Browser history management resources
}
=====*/


(function(){ 
	var back = dojo.back;

	// everyone deals with encoding the hash slightly differently

	function getHash(){ 
		var h = window.location.hash;
		if(h.charAt(0) == "#"){ h = h.substring(1); }
		return dojo.isMozilla ? h : decodeURIComponent(h); 
	}
	
	function setHash(h){
		if(!h){ h = ""; }
		window.location.hash = encodeURIComponent(h);
		historyCounter = history.length;
	}
	
	// if we're in the test for these methods, expose them on dojo.back. ok'd with alex.
	if(dojo.exists("tests.back-hash")){
		back.getHash = getHash;
		back.setHash = setHash;		
	}
	
	var initialHref = (typeof(window) !== "undefined") ? window.location.href : "";
	var initialHash = (typeof(window) !== "undefined") ? getHash() : "";
	var initialState = null;

	var locationTimer = null;
	var bookmarkAnchor = null;
	var historyIframe = null;
	var forwardStack = [];
	var historyStack = [];
	var moveForward = false;
	var changingUrl = false;
	var historyCounter;

	function handleBackButton(){
		//summary: private method. Do not call this directly.

		//The "current" page is always at the top of the history stack.
		//console.debug("handlingBackButton");
		var current = historyStack.pop();
		if(!current){ return; }
		var last = historyStack[historyStack.length-1];
		if(!last && historyStack.length == 0){
			last = initialState;
		}
		if(last){
			if(last.kwArgs["back"]){
				last.kwArgs["back"]();
			}else if(last.kwArgs["backButton"]){
				last.kwArgs["backButton"]();
			}else if(last.kwArgs["handle"]){
				last.kwArgs.handle("back");
			}
		}
		forwardStack.push(current);
		//console.debug("done handling back");
	}

	back.goBack = handleBackButton;

	function handleForwardButton(){
		//summary: private method. Do not call this directly.
		//console.debug("handling forward");
		var last = forwardStack.pop();
		if(!last){ return; }
		if(last.kwArgs["forward"]){
			last.kwArgs.forward();
		}else if(last.kwArgs["forwardButton"]){
			last.kwArgs.forwardButton();
		}else if(last.kwArgs["handle"]){
			last.kwArgs.handle("forward");
		}
		historyStack.push(last);
		//console.debug("done handling forward");
	}

	back.goForward = handleForwardButton;

	function createState(url, args, hash){
		//summary: private method. Do not call this directly.
		return {"url": url, "kwArgs": args, "urlHash": hash};	//Object
	}

	function getUrlQuery(url){
		//summary: private method. Do not call this directly.
		var segments = url.split("?");
		if(segments.length < 2){
			return null; //null
		}
		else{
			return segments[1]; //String
		}
	}
	
	function loadIframeHistory(){
		//summary: private method. Do not call this directly.
		var url = (dojo.config["dojoIframeHistoryUrl"] || dojo.moduleUrl("dojo", "resources/iframe_history.html")) + "?" + (new Date()).getTime();
		moveForward = true;
        if(historyIframe){
		    dojo.isSafari ? historyIframe.location = url : window.frames[historyIframe.name].location = url;
        }else{
            //console.warn("dojo.back: Not initialised. You need to call dojo.back.init() from a <script> block that lives inside the <body> tag.");
        }
		return url; //String
	}

	function checkLocation(){
		//console.debug("checking url");
		if(!changingUrl){
			var hsl = historyStack.length;
			
			var hash = getHash();

			if((hash === initialHash||window.location.href == initialHref)&&(hsl == 1)){
				// FIXME: could this ever be a forward button?
				// we can't clear it because we still need to check for forwards. Ugg.
				// clearInterval(this.locationTimer);
				handleBackButton();
				return;
			}
			
			// first check to see if we could have gone forward. We always halt on
			// a no-hash item.
			if(forwardStack.length > 0){
				if(forwardStack[forwardStack.length-1].urlHash === hash){
					handleForwardButton();
					return;
				}
			}
	
			// ok, that didn't work, try someplace back in the history stack
			if((hsl >= 2)&&(historyStack[hsl-2])){
				if(historyStack[hsl-2].urlHash === hash){
					handleBackButton();
					return;
				}
			}
			
			if(dojo.isSafari && dojo.isSafari < 3){
				var hisLen = history.length;
				if(hisLen > historyCounter) handleForwardButton();
				else if(hisLen < historyCounter) handleBackButton();
			  historyCounter = hisLen;
			}
		}
		//console.debug("done checking");
	};
	
	back.init = function(){
		//summary: Initializes the undo stack. This must be called from a <script> 
		//         block that lives inside the <body> tag to prevent bugs on IE.
		if(dojo.byId("dj_history")){ return; } // prevent reinit
		var src = dojo.config["dojoIframeHistoryUrl"] || dojo.moduleUrl("dojo", "resources/iframe_history.html");
		document.write('<iframe style="border:0;width:1px;height:1px;position:absolute;visibility:hidden;bottom:0;right:0;" name="dj_history" id="dj_history" src="' + src + '"></iframe>');
	};

	back.setInitialState = function(/*Object*/args){
		//summary: 
		//		Sets the state object and back callback for the very first page
		//		that is loaded.
		//description:
		//		It is recommended that you call this method as part of an event
		//		listener that is registered via dojo.addOnLoad().
		//args: Object
		//		See the addToHistory() function for the list of valid args properties.
		initialState = createState(initialHref, args, initialHash);
	};

	//FIXME: Make these doc comments not be awful. At least they're not wrong.
	//FIXME: Would like to support arbitrary back/forward jumps. Have to rework iframeLoaded among other things.
	//FIXME: is there a slight race condition in moz using change URL with the timer check and when
	//       the hash gets set? I think I have seen a back/forward call in quick succession, but not consistent.

	
	/*=====
	dojo.__backArgs = function(kwArgs){
		// back: Function?
		//		A function to be called when this state is reached via the user
		//		clicking the back button.
		//	forward: Function?
		//		Upon return to this state from the "back, forward" combination
		//		of navigation steps, this function will be called. Somewhat
		//		analgous to the semantic of an "onRedo" event handler.
		//	changeUrl: Boolean?|String?
		//		Boolean indicating whether or not to create a unique hash for
		//		this state. If a string is passed instead, it is used as the
		//		hash.
	}
	=====*/

	back.addToHistory = function(/*dojo.__backArgs*/ args){
		//	summary: 
		//		adds a state object (args) to the history list. 
		//	description:
		//		To support getting back button notifications, the object
		//		argument should implement a function called either "back",
		//		"backButton", or "handle". The string "back" will be passed as
		//		the first and only argument to this callback.
		//	
		//		To support getting forward button notifications, the object
		//		argument should implement a function called either "forward",
		//		"forwardButton", or "handle". The string "forward" will be
		//		passed as the first and only argument to this callback.
		//
		//		If you want the browser location string to change, define "changeUrl" on the object. If the
		//		value of "changeUrl" is true, then a unique number will be appended to the URL as a fragment
		//		identifier (http://some.domain.com/path#uniquenumber). If it is any other value that does
		//		not evaluate to false, that value will be used as the fragment identifier. For example,
		//		if changeUrl: 'page1', then the URL will look like: http://some.domain.com/path#page1
		//
	 	//	example:
		//		|	dojo.back.addToHistory({
		//		|		back: function(){ console.debug('back pressed'); },
		//		|		forward: function(){ console.debug('forward pressed'); },
		//		|		changeUrl: true
		//		|	});

		//	BROWSER NOTES:
		//  Safari 1.2: 
		//	back button "works" fine, however it's not possible to actually
		//	DETECT that you've moved backwards by inspecting window.location.
		//	Unless there is some other means of locating.
		//	FIXME: perhaps we can poll on history.length?
		//	Safari 2.0.3+ (and probably 1.3.2+):
		//	works fine, except when changeUrl is used. When changeUrl is used,
		//	Safari jumps all the way back to whatever page was shown before
		//	the page that uses dojo.undo.browser support.
		//	IE 5.5 SP2:
		//	back button behavior is macro. It does not move back to the
		//	previous hash value, but to the last full page load. This suggests
		//	that the iframe is the correct way to capture the back button in
		//	these cases.
		//	Don't test this page using local disk for MSIE. MSIE will not create 
		//	a history list for iframe_history.html if served from a file: URL. 
		//	The XML served back from the XHR tests will also not be properly 
		//	created if served from local disk. Serve the test pages from a web 
		//	server to test in that browser.
		//	IE 6.0:
		//	same behavior as IE 5.5 SP2
		//	Firefox 1.0+:
		//	the back button will return us to the previous hash on the same
		//	page, thereby not requiring an iframe hack, although we do then
		//	need to run a timer to detect inter-page movement.

		//If addToHistory is called, then that means we prune the
		//forward stack -- the user went back, then wanted to
		//start a new forward path.
		forwardStack = []; 

		var hash = null;
		var url = null;
		if(!historyIframe){
			if(dojo.config["useXDomain"] && !dojo.config["dojoIframeHistoryUrl"]){
				console.warn("dojo.back: When using cross-domain Dojo builds,"
					+ " please save iframe_history.html to your domain and set djConfig.dojoIframeHistoryUrl"
					+ " to the path on your domain to iframe_history.html");
			}
			historyIframe = window.frames["dj_history"];
		}
		if(!bookmarkAnchor){
			bookmarkAnchor = document.createElement("a");
			dojo.body().appendChild(bookmarkAnchor);
			bookmarkAnchor.style.display = "none";
		}
		if(args["changeUrl"]){
			hash = ""+ ((args["changeUrl"]!==true) ? args["changeUrl"] : (new Date()).getTime());
			
			//If the current hash matches the new one, just replace the history object with
			//this new one. It doesn't make sense to track different state objects for the same
			//logical URL. This matches the browser behavior of only putting in one history
			//item no matter how many times you click on the same #hash link, at least in Firefox
			//and Safari, and there is no reliable way in those browsers to know if a #hash link
			//has been clicked on multiple times. So making this the standard behavior in all browsers
			//so that dojo.back's behavior is the same in all browsers.
			if(historyStack.length == 0 && initialState.urlHash == hash){
				initialState = createState(url, args, hash);
				return;
			}else if(historyStack.length > 0 && historyStack[historyStack.length - 1].urlHash == hash){
				historyStack[historyStack.length - 1] = createState(url, args, hash);
				return;
			}

			changingUrl = true;
			setTimeout(function() { 
					setHash(hash); 
					changingUrl = false; 					
				}, 1);
			bookmarkAnchor.href = hash;
			
			if(dojo.isIE){
				url = loadIframeHistory();

				var oldCB = args["back"]||args["backButton"]||args["handle"];

				//The function takes handleName as a parameter, in case the
				//callback we are overriding was "handle". In that case,
				//we will need to pass the handle name to handle.
				var tcb = function(handleName){
					if(getHash() != ""){
						setTimeout(function() { setHash(hash); }, 1);
					}
					//Use apply to set "this" to args, and to try to avoid memory leaks.
					oldCB.apply(this, [handleName]);
				};
		
				//Set interceptor function in the right place.
				if(args["back"]){
					args.back = tcb;
				}else if(args["backButton"]){
					args.backButton = tcb;
				}else if(args["handle"]){
					args.handle = tcb;
				}
		
				var oldFW = args["forward"]||args["forwardButton"]||args["handle"];
		
				//The function takes handleName as a parameter, in case the
				//callback we are overriding was "handle". In that case,
				//we will need to pass the handle name to handle.
				var tfw = function(handleName){
					if(getHash() != ""){
						setHash(hash);
					}
					if(oldFW){ // we might not actually have one
						//Use apply to set "this" to args, and to try to avoid memory leaks.
						oldFW.apply(this, [handleName]);
					}
				};

				//Set interceptor function in the right place.
				if(args["forward"]){
					args.forward = tfw;
				}else if(args["forwardButton"]){
					args.forwardButton = tfw;
				}else if(args["handle"]){
					args.handle = tfw;
				}

			}else if(!dojo.isIE){
				// start the timer
				if(!locationTimer){
					locationTimer = setInterval(checkLocation, 200);
				}
				
			}
		}else{
			url = loadIframeHistory();
		}

		historyStack.push(createState(url, args, hash));
	};

	back._iframeLoaded = function(evt, ifrLoc){
		//summary: 
		//		private method. Do not call this directly.
		var query = getUrlQuery(ifrLoc.href);
		if(query == null){ 
			// alert("iframeLoaded");
			// we hit the end of the history, so we should go back
			if(historyStack.length == 1){
				handleBackButton();
			}
			return;
		}
		if(moveForward){
			// we were expecting it, so it's not either a forward or backward movement
			moveForward = false;
			return;
		}
	
		//Check the back stack first, since it is more likely.
		//Note that only one step back or forward is supported.
		if(historyStack.length >= 2 && query == getUrlQuery(historyStack[historyStack.length-2].url)){
			handleBackButton();
		}else if(forwardStack.length > 0 && query == getUrlQuery(forwardStack[forwardStack.length-1].url)){
			handleForwardButton();
		}
	};
 })();

// SIG // Begin signature block
// SIG // MIIXSwYJKoZIhvcNAQcCoIIXPDCCFzgCAQExCzAJBgUr
// SIG // DgMCGgUAMGcGCisGAQQBgjcCAQSgWTBXMDIGCisGAQQB
// SIG // gjcCAR4wJAIBAQQQEODJBs441BGiowAQS9NQkAIBAAIB
// SIG // AAIBAAIBAAIBADAhMAkGBSsOAwIaBQAEFPvoDCtqm2+u
// SIG // aWzRzq5EP9BOuESQoIISJDCCBGAwggNMoAMCAQICCi6r
// SIG // EdxQ/1ydy8AwCQYFKw4DAh0FADBwMSswKQYDVQQLEyJD
// SIG // b3B5cmlnaHQgKGMpIDE5OTcgTWljcm9zb2Z0IENvcnAu
// SIG // MR4wHAYDVQQLExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // ITAfBgNVBAMTGE1pY3Jvc29mdCBSb290IEF1dGhvcml0
// SIG // eTAeFw0wNzA4MjIyMjMxMDJaFw0xMjA4MjUwNzAwMDBa
// SIG // MHkxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xIzAhBgNVBAMTGk1p
// SIG // Y3Jvc29mdCBDb2RlIFNpZ25pbmcgUENBMIIBIjANBgkq
// SIG // hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt3l91l2zRTmo
// SIG // NKwx2vklNUl3wPsfnsdFce/RRujUjMNrTFJi9JkCw03Y
// SIG // SWwvJD5lv84jtwtIt3913UW9qo8OUMUlK/Kg5w0jH9FB
// SIG // JPpimc8ZRaWTSh+ZzbMvIsNKLXxv2RUeO4w5EDndvSn0
// SIG // ZjstATL//idIprVsAYec+7qyY3+C+VyggYSFjrDyuJSj
// SIG // zzimUIUXJ4dO3TD2AD30xvk9gb6G7Ww5py409rQurwp9
// SIG // YpF4ZpyYcw2Gr/LE8yC5TxKNY8ss2TJFGe67SpY7UFMY
// SIG // zmZReaqth8hWPp+CUIhuBbE1wXskvVJmPZlOzCt+M26E
// SIG // RwbRntBKhgJuhgCkwIffUwIDAQABo4H6MIH3MBMGA1Ud
// SIG // JQQMMAoGCCsGAQUFBwMDMIGiBgNVHQEEgZowgZeAEFvQ
// SIG // cO9pcp4jUX4Usk2O/8uhcjBwMSswKQYDVQQLEyJDb3B5
// SIG // cmlnaHQgKGMpIDE5OTcgTWljcm9zb2Z0IENvcnAuMR4w
// SIG // HAYDVQQLExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xITAf
// SIG // BgNVBAMTGE1pY3Jvc29mdCBSb290IEF1dGhvcml0eYIP
// SIG // AMEAizw8iBHRPvZj7N9AMA8GA1UdEwEB/wQFMAMBAf8w
// SIG // HQYDVR0OBBYEFMwdznYAcFuv8drETppRRC6jRGPwMAsG
// SIG // A1UdDwQEAwIBhjAJBgUrDgMCHQUAA4IBAQB7q65+Siby
// SIG // zrxOdKJYJ3QqdbOG/atMlHgATenK6xjcacUOonzzAkPG
// SIG // yofM+FPMwp+9Vm/wY0SpRADulsia1Ry4C58ZDZTX2h6t
// SIG // KX3v7aZzrI/eOY49mGq8OG3SiK8j/d/p1mkJkYi9/uEA
// SIG // uzTz93z5EBIuBesplpNCayhxtziP4AcNyV1ozb2AQWtm
// SIG // qLu3u440yvIDEHx69dLgQt97/uHhrP7239UNs3DWkuNP
// SIG // tjiifC3UPds0C2I3Ap+BaiOJ9lxjj7BauznXYIxVhBoz
// SIG // 9TuYoIIMol+Lsyy3oaXLq9ogtr8wGYUgFA0qvFL0QeBe
// SIG // MOOSKGmHwXDi86erzoBCcnYOMIIEejCCA2KgAwIBAgIK
// SIG // YQYngQAAAAAACDANBgkqhkiG9w0BAQUFADB5MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSMwIQYDVQQDExpNaWNyb3NvZnQg
// SIG // Q29kZSBTaWduaW5nIFBDQTAeFw0wODEwMjIyMTI0NTVa
// SIG // Fw0xMDAxMjIyMTM0NTVaMIGDMQswCQYDVQQGEwJVUzET
// SIG // MBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
// SIG // bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
// SIG // aW9uMQ0wCwYDVQQLEwRNT1BSMR4wHAYDVQQDExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24wggEiMA0GCSqGSIb3DQEB
// SIG // AQUAA4IBDwAwggEKAoIBAQC9crSJ5xyfhcd0uGBcAzY9
// SIG // nP2ZepopRiKwp4dT7e5GOsdbBQtXqLfKBczTTHdHcIWz
// SIG // 5cvfZ+ej/XQnk2ef14oDRDDG98m6yTodCFZETxcIDfm0
// SIG // GWiqJBz7BVeF6cVOByE3p+vOLC+2Qs0hBafW5tMoV8cb
// SIG // es4pNgfNnlXMu/Ei66gjpA0pwvvQw1o+Yz3HLEkLe3mF
// SIG // 8Ijvcb1DWuOjsw3zVfsl4OIg0+eaXpSlMy0of1cbVWoM
// SIG // MkTvZmxv8Dic7wKtmqHdmAcQDjwYaeJ5TkYU4LmM0HVt
// SIG // nKwAnC1C9VG4WvR4RYPpLnwru13NGWEorZRDCsVqQv+1
// SIG // Mq6kKSLeFujTAgMBAAGjgfgwgfUwEwYDVR0lBAwwCgYI
// SIG // KwYBBQUHAwMwHQYDVR0OBBYEFCPRcypMvfvlIfpxHpkV
// SIG // 0Rf5xKaKMA4GA1UdDwEB/wQEAwIHgDAfBgNVHSMEGDAW
// SIG // gBTMHc52AHBbr/HaxE6aUUQuo0Rj8DBEBgNVHR8EPTA7
// SIG // MDmgN6A1hjNodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20v
// SIG // cGtpL2NybC9wcm9kdWN0cy9DU1BDQS5jcmwwSAYIKwYB
// SIG // BQUHAQEEPDA6MDgGCCsGAQUFBzAChixodHRwOi8vd3d3
// SIG // Lm1pY3Jvc29mdC5jb20vcGtpL2NlcnRzL0NTUENBLmNy
// SIG // dDANBgkqhkiG9w0BAQUFAAOCAQEAQynPY71s43Ntw5nX
// SIG // bQyIO8ZIc3olziziN3udNJ+9I86+39hceRFrE1EgAWO5
// SIG // cvcI48Z9USoWKNTR55sqzxgN0hNxkSnsVr351sUNL69l
// SIG // LW1NRSlWcoRPP9JqHUFiqXlcjvDHd4rLAiguncecK+W5
// SIG // Kgnd7Jfi5XqNXhCIU6HdYE93mHFgqFs5kdOrEh8F6cNF
// SIG // qdPCUbmvuNz8BoQA9HSj2//MHaAjBQfkJzXCl5AZqoJg
// SIG // J+j7hCse0QTLjs+CDdeoTUNAddLe3XfvilxrD4dkj7S6
// SIG // t7qrZ1QhRapKaOdUXosUXGd47JBcAxCRCJ0kIJfo3wAR
// SIG // cKn5snJwt67iwp8WAjCCBJ0wggOFoAMCAQICCmFHUroA
// SIG // AAAAAAQwDQYJKoZIhvcNAQEFBQAweTELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEjMCEGA1UEAxMaTWljcm9zb2Z0IFRpbWVz
// SIG // dGFtcGluZyBQQ0EwHhcNMDYwOTE2MDE1MzAwWhcNMTEw
// SIG // OTE2MDIwMzAwWjCBpjELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEn
// SIG // MCUGA1UECxMebkNpcGhlciBEU0UgRVNOOkQ4QTktQ0ZD
// SIG // Qy01NzlDMScwJQYDVQQDEx5NaWNyb3NvZnQgVGltZXN0
// SIG // YW1waW5nIFNlcnZpY2UwggEiMA0GCSqGSIb3DQEBAQUA
// SIG // A4IBDwAwggEKAoIBAQCbbdyGUegyOzc6liWyz2/uYbVB
// SIG // 0hg7Wp14Z7r4H9kIVZKIfuNBU/rsKFT+tdr+cDuVJ0h+
// SIG // Q6AyLyaBSvICdnfIyan4oiFYfg29Adokxv5EEQU1OgGo
// SIG // 6lQKMyyH0n5Bs+gJ2bC+45klprwl7dfTjtv0t20bSQvm
// SIG // 08OHbu5GyX/zbevngx6oU0Y/yiR+5nzJLPt5FChFwE82
// SIG // a1Map4az5/zhwZ9RCdu8pbv+yocJ9rcyGb7hSlG8vHys
// SIG // LJVql3PqclehnIuG2Ju9S/wnM8FtMqzgaBjYbjouIkPR
// SIG // +Y/t8QABDWTAyaPdD/HI6VTKEf/ceCk+HaxYwNvfqtyu
// SIG // ZRvTnbxnAgMBAAGjgfgwgfUwHQYDVR0OBBYEFE8YiYrS
// SIG // ygB4xuxZDQ/9fMTBIoDeMB8GA1UdIwQYMBaAFG/oTj+X
// SIG // uTSrS4aPvJzqrDtBQ8bQMEQGA1UdHwQ9MDswOaA3oDWG
// SIG // M2h0dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3Js
// SIG // L3Byb2R1Y3RzL3RzcGNhLmNybDBIBggrBgEFBQcBAQQ8
// SIG // MDowOAYIKwYBBQUHMAKGLGh0dHA6Ly93d3cubWljcm9z
// SIG // b2Z0LmNvbS9wa2kvY2VydHMvdHNwY2EuY3J0MBMGA1Ud
// SIG // JQQMMAoGCCsGAQUFBwMIMA4GA1UdDwEB/wQEAwIGwDAN
// SIG // BgkqhkiG9w0BAQUFAAOCAQEANyce9YxA4PZlJj5kxJC8
// SIG // PuNXhd1DDUCEZ76HqCra3LQ2IJiOM3wuX+BQe2Ex8xoT
// SIG // 3oS96mkcWHyzG5PhCCeBRbbUcMoUt1+6V+nUXtA7Q6q3
// SIG // P7baYYtxz9R91Xtuv7TKWjCR39oKDqM1nyVhTsAydCt6
// SIG // BpRyAKwYnUvlnivFOlSspGDYp/ebf9mpbe1Ea7rc4BL6
// SIG // 8K2HDJVjCjIeiU7MzH6nN6X+X9hn+kZL0W0dp33SvgL/
// SIG // 826C84d0xGnluXDMS2WjBzWpRJ6EfTlu/hQFvRpQIbU+
// SIG // n/N3HI/Cmp1X4Wl9aeiDzwJvKiK7NzM6cvrWMB2RrfZQ
// SIG // GusT3jrFt1zNszCCBJ0wggOFoAMCAQICEGoLmU/AACWr
// SIG // EdtFH1h6Z6IwDQYJKoZIhvcNAQEFBQAwcDErMCkGA1UE
// SIG // CxMiQ29weXJpZ2h0IChjKSAxOTk3IE1pY3Jvc29mdCBD
// SIG // b3JwLjEeMBwGA1UECxMVTWljcm9zb2Z0IENvcnBvcmF0
// SIG // aW9uMSEwHwYDVQQDExhNaWNyb3NvZnQgUm9vdCBBdXRo
// SIG // b3JpdHkwHhcNMDYwOTE2MDEwNDQ3WhcNMTkwOTE1MDcw
// SIG // MDAwWjB5MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSMwIQYDVQQD
// SIG // ExpNaWNyb3NvZnQgVGltZXN0YW1waW5nIFBDQTCCASIw
// SIG // DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANw3bvuv
// SIG // yEJKcRjIzkg+U8D6qxS6LDK7Ek9SyIPtPjPZSTGSKLaR
// SIG // ZOAfUIS6wkvRfwX473W+i8eo1a5pcGZ4J2botrfvhbnN
// SIG // 7qr9EqQLWSIpL89A2VYEG3a1bWRtSlTb3fHev5+Dx4Df
// SIG // f0wCN5T1wJ4IVh5oR83ZwHZcL322JQS0VltqHGP/gHw8
// SIG // 7tUEJU05d3QHXcJc2IY3LHXJDuoeOQl8dv6dbG564Ow+
// SIG // j5eecQ5fKk8YYmAyntKDTisiXGhFi94vhBBQsvm1Go1s
// SIG // 7iWbE/jLENeFDvSCdnM2xpV6osxgBuwFsIYzt/iUW4RB
// SIG // hFiFlG6wHyxIzG+cQ+Bq6H8mjmsCAwEAAaOCASgwggEk
// SIG // MBMGA1UdJQQMMAoGCCsGAQUFBwMIMIGiBgNVHQEEgZow
// SIG // gZeAEFvQcO9pcp4jUX4Usk2O/8uhcjBwMSswKQYDVQQL
// SIG // EyJDb3B5cmlnaHQgKGMpIDE5OTcgTWljcm9zb2Z0IENv
// SIG // cnAuMR4wHAYDVQQLExVNaWNyb3NvZnQgQ29ycG9yYXRp
// SIG // b24xITAfBgNVBAMTGE1pY3Jvc29mdCBSb290IEF1dGhv
// SIG // cml0eYIPAMEAizw8iBHRPvZj7N9AMBAGCSsGAQQBgjcV
// SIG // AQQDAgEAMB0GA1UdDgQWBBRv6E4/l7k0q0uGj7yc6qw7
// SIG // QUPG0DAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTAL
// SIG // BgNVHQ8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zANBgkq
// SIG // hkiG9w0BAQUFAAOCAQEAlE0RMcJ8ULsRjqFhBwEOjHBF
// SIG // je9zVL0/CQUt/7hRU4Uc7TmRt6NWC96Mtjsb0fusp8m3
// SIG // sVEhG28IaX5rA6IiRu1stG18IrhG04TzjQ++B4o2wet+
// SIG // 6XBdRZ+S0szO3Y7A4b8qzXzsya4y1Ye5y2PENtEYIb92
// SIG // 3juasxtzniGI2LS0ElSM9JzCZUqaKCacYIoPO8cTZXhI
// SIG // u8+tgzpPsGJY3jDp6Tkd44ny2jmB+RMhjGSAYwYElvKa
// SIG // AkMve0aIuv8C2WX5St7aA3STswVuDMyd3ChhfEjxF5wR
// SIG // ITgCHIesBsWWMrjlQMZTPb2pid7oZjeN9CKWnMywd1RR
// SIG // OtZyRLIj9jGCBJMwggSPAgEBMIGHMHkxCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xIzAhBgNVBAMTGk1pY3Jvc29mdCBDb2Rl
// SIG // IFNpZ25pbmcgUENBAgphBieBAAAAAAAIMAkGBSsOAwIa
// SIG // BQCggb4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQw
// SIG // HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwIwYJ
// SIG // KoZIhvcNAQkEMRYEFO1qc3tHt/N9q1eBMvk2NGQjnX+8
// SIG // MF4GCisGAQQBgjcCAQwxUDBOoCaAJABNAGkAYwByAG8A
// SIG // cwBvAGYAdAAgAEwAZQBhAHIAbgBpAG4AZ6EkgCJodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20vbGVhcm5pbmcgMA0G
// SIG // CSqGSIb3DQEBAQUABIIBAAHxX5rGzxLrlU53ylj+4FTG
// SIG // AytD09UzHWFYZDumzDgSG3+CepKJQnUh9Dg3AUOi0NWR
// SIG // 3A+u0TL3n+OhJfVlOngUDcCxdeJtmMlv6YOkCBzEu8+d
// SIG // GZI8T5ZxO5vv+OXlQU5yIu4DMutNYxW0RUl3GF5Z7zCU
// SIG // e3kpf/kpMGBk82tW7I3eEGMF20Qn5BTLVo5UkHOmCR8o
// SIG // uwdZjBfL8SZ6p/aStzfLP0vRWsdt1jDaKkoeZo8vGuDg
// SIG // /g4uA36o2hzVtIZmCNj2jli+SGZwQgBACehlrAjl4Q7a
// SIG // ZzsDhSwqWUDoh6vN2l26oJTqcX5G2ABmZRCF2Q7AB8LT
// SIG // upHqufxVBomhggIfMIICGwYJKoZIhvcNAQkGMYICDDCC
// SIG // AggCAQEwgYcweTELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEjMCEG
// SIG // A1UEAxMaTWljcm9zb2Z0IFRpbWVzdGFtcGluZyBQQ0EC
// SIG // CmFHUroAAAAAAAQwBwYFKw4DAhqgXTAYBgkqhkiG9w0B
// SIG // CQMxCwYJKoZIhvcNAQcBMBwGCSqGSIb3DQEJBTEPFw0w
// SIG // ODEyMTAyMDU0MDRaMCMGCSqGSIb3DQEJBDEWBBSBNX6R
// SIG // 6DmycUpW72i0LXtFk7CMwjANBgkqhkiG9w0BAQUFAASC
// SIG // AQBgIuQiZ+AtNQF71dw/J3A7Or1Boz/2FsRiGQXSLnuc
// SIG // fakmY/3EqVSf+x1Kpxz2EjQpVj5MaipL3Nz38ieGyugw
// SIG // U6ZpbLVHYHt0nGbDxDQnjGDwMtLCMfDXw8mOJPnXjLgE
// SIG // v2tuu/V7zhjQJuBLzqLg13voYI32XVIbEm+yojQCwZF6
// SIG // y+GkSNxsvQp1N7WGFn/pLW7JUloygxvjG6zfVF0d7IxD
// SIG // tKwUVx7MCvgv62EaBisdGHr3dz9FdbbYIg3VzSDQRxUL
// SIG // rePBHBk6xqPxrlN4VQDkTcfmJRRqMu1Lxm7aPPs+fPZv
// SIG // isod0nbRiTlY18EY0WrOJ3fxSXBT5Xw0c0T/
// SIG // End signature block
