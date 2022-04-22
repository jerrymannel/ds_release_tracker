var d = document;
d.i = d.getElementById;
d.c = d.getElementsByClassName

// --------- FOR USERS ---------------
var base_url = localStorage.getItem("base_url");
var username = localStorage.getItem("username");
var password = localStorage.getItem("password");
// --------- FOR USERS ---------------

var token = localStorage.getItem("token");

function apiCaller(method, api, headers, urlParams, payload, cb) {
	let constructedURL = `${base_url}${api}`;
	let xhttp = new XMLHttpRequest();
	
	if (urlParams){
		constructedURL += "?";
		for(var key in urlParams){
			if (key == "filter") constructedURL += `${key}=${JSON.stringify(urlParams[key])}&`;
			else constructedURL += `${key}=${urlParams[key]}&`;
		}
	}
	constructedURL = encodeURI(constructedURL)

	xhttp.open(method, constructedURL, true);
	xhttp.setRequestHeader("Content-type", "application/json");
	if (token) {
		xhttp.setRequestHeader("Authorization", `JWT ${token}`);
	}

	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			if(this.status == 200) {
				if (api == "/api/a/rbac/login") {
					let responseText = JSON.parse(this.responseText)
					token = responseText.token
					localStorage.setItem("token", token);
					checkConfig();
				}
				else {
					cb(JSON.parse(this.responseText))
				}
			} else if(this.status == 401) {
				localStorage.removeItem("token");
				token = null;
				checkConfig();
			} else {
				alert(this.responseText)
			}
		}
	};
	if(payload) xhttp.send(JSON.stringify(payload));
	else xhttp.send();
}