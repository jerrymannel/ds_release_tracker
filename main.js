const statusClassMapper = {
	"Open": "open",
	"In Progress": "inprogress",
	"Ready for QA": "readyforqa",
	"Ready for Release": "readyforrelease",
	"Rejected": "rejected",
	"Cannot Reproduce": "cannotreproduce",
	"Working as Expected": "workingasexpected",
	"Configuration Issue": "configurationissue",
	"Duplicate": "duplicate",
	"Closed": "closed",
	"Re-Open": "reopen",
	"Fixed": "fixed",
	"Ready for I&T": "readyforit",
	"Status": "status",
	"Total": "total",
};

const PRIORITY = ["highest", "high", "medium", "low", "lowest"];

const status_classes = ["status_open", "status_inprogress", "status_readyforqa", "status_readyforrelease", "status_rejected", "status_cannotreproduce", "status_workingasexpected", "status_configurationissue", "status_duplicate", "status_closed", "status_reopen", "status_fixed", "status_readyforit"];

const default_hidden_classes = ["status_closed", "status_cannotreproduce", "status_configurationissue", "status_duplicate", "status_rejected", "status_workingasexpected"];

const open_classes = ["status_open", "status_reopen", "status_inprogress"];

const priority_classes = ["priority_highest", "priority_high", "priority_medium", "priority_low", "priority_lowest"];

var releases = null;


var RELEASE = "REL1011";

var statusSummaryTable = d.i("statusSummaryTable");

function checkConfig(){
	// let div_display = d.i("div-display");
	// let div_login = d.i("div_login");
	// let div_config = d.i("div_config");
	// div_display.style.display = "none";
	// div_login.style.display = "none";
	// div_config.style.display = "none";
	if(token){
		// div_display.style.display = "flex";
		getReleases();
	} else if(!base_url || !username || !password) {
		localStorage.removeItem("token");
		localStorage.removeItem("base_url");
		localStorage.removeItem("username");
		localStorage.removeItem("password");
		div_config.style.display = "block";
	} else {
		div_login.style.display = "block";
	}
}

function saveConfig(){
	base_url = d.i("input_url").value;
	username = d.i("input_username").value;
	password = d.i("input_password").value;
	localStorage.setItem("base_url", base_url);
	localStorage.setItem("username", username);
	localStorage.setItem("password", password);
	checkConfig();
}

function reset(){
	localStorage.removeItem("token");
	localStorage.removeItem("base_url");
	localStorage.removeItem("username");
	localStorage.removeItem("password");
	checkConfig();
}

function login(){
	let data = {username, password};
	apiCaller("POST", "/api/a/rbac/login", null, null, data, getReleases)
}

function generateFilter(release){
	return {"$and":[{"$or":[{"releaseVersion._id":`/${release}/`},{"releaseVersion.releaseVersion":`/${release}/`}]}]}
}

function getReleases(){
	let select = "_id,releaseVersion,plannedReleaseDate,released";
	let count = 10000;
	let sort = "releaseVersion";
	apiCaller("GET", "/api/c/data-stack/release", null, {select, sort, count}, null, getReleasesCB)
}
getReleases();

function getReleasesCB(data){
	releases = data;
	let dataMenuReleases = d.i("data-releases");
	dataMenuReleases.innerHTML = "";
	let button = document.createElement("button");
	button.setAttribute("class", "btn btn-sm btn-dark text-light");
	button.innerHTML = "vNext";
	button.addEventListener("click", () => getDefects("REL1011", "vNext"));
	dataMenuReleases.appendChild(button);
	releases.forEach((release, index) => {
		let clone = button.cloneNode();
		clone.innerHTML = release.releaseVersion;
		clone.setAttribute("class", "btn btn-sm btn-light");
		clone.addEventListener("click", () => getDefects(release._id, release.releaseVersion));
		if (release.releaseVersion != "vNext" && release.releaseVersion != "Backlog") {
			dataMenuReleases.appendChild(clone);
		}
	});
	let clone = button.cloneNode();
	clone.addEventListener("click", () => getDefects("REL1011", "vNext"));
	clone.innerHTML = "Backlog";
	clone.addEventListener("click", () => getDefects("REL1005", "Backlog"));
	dataMenuReleases.appendChild(clone);
	getDefects("REL1011", "vNext");
}

function getDefects(releaseId, releaseName){
	d.i("release-details-title").innerHTML = releaseName;
	RELEASE = releaseId;
	let filter = {"releaseVersion._id":`/${releaseId}/`};
	let select = "_id,summary,priority,estimateDays,status,releaseVersion.releaseVersion,assignedTo._id,verifiedBy._id,reportedBy._id";
	let count = 10000;
	let sort = "priority";
	apiCaller("GET", "/api/c/data-stack/defects", null, {filter, select, sort, count}, null, getDetectsCB)
}

function getDefectPriorityAggregation(){
	let aggregationPipeline = [{"$match": {"releaseVersion._id": RELEASE}},{"$group": {"_id": "$priority","count": {"$sum": 1}}},{"$sort": {"_id": 1}}];
	apiCaller("POST", "/api/c/data-stack/defects/utils/aggregate", null, null, aggregationPipeline, getDefectPriorityAggregationCB)
}

function getDefectPriorityAggregationCB(data){
	let counter = {"highest": 0,"high": 0,"medium": 0,"low": 0,"lowest": 0};
	let count = 0;
	data.forEach(d => {
		counter[d._id.toLowerCase()] = d.count;
		count += d.count;
	});
	
	statusSummaryTable.innerHTML = "";
	statusSummaryTable.appendChild(generateStatusSummaryRow("statusAll", 1, "Status", {"count":"Count", "highest":"Highest", "high":"High", "medium":"Medium", "low":"Low", "lowest":"Lowest"}))
	statusSummaryTable.appendChild(generateStatusSummaryRow("statusAll", 2, "Total", {...counter, ...{count}}))
	getDefectStatusAggregation();
	getDevTeamDefectStatusAggregation();
}

function getDefectStatusAggregation(){
	let aggregationPipeline = [{"$match": {"releaseVersion._id": RELEASE}},{"$group": {"_id": "$status","count": {"$sum": 1},"high": {"$sum": {"$cond": {"else": 0,"if": {"$eq": ["$priority","High"]},"then": 1}}},"highest": {"$sum": {"$cond": {"else": 0,"if": {"$eq": ["$priority","Highest"]},"then": 1}}},"low": {"$sum": {"$cond": {"else": 0,"if": {"$eq": ["$priority","Low"]},"then": 1}}},"lowest": {"$sum": {"$cond": {"else": 0,"if": {"$eq": ["$priority","Lowest"]},"then": 1}}},"medium": {"$sum": {"$cond": {"else": 0,"if": {"$eq": ["$priority","Medium"]},"then": 1}}}}},{"$sort": {"_id": 1}}]
	apiCaller("POST", "/api/c/data-stack/defects/utils/aggregate", null, null, aggregationPipeline, getDefectStatusAggregationCB)
}

function generateDummyEntry(_id){
	return {"_id": _id, "count": 0, "highest": 0,"high": 0,"medium": 0,"low": 0,"lowest": 0}
}

function getDefectStatusAggregationCB(data){
	let newData = [
		data.filter(d => d._id=="Open")[0] || generateDummyEntry("Open"),
		data.filter(d => d._id=="Re-Open")[0] || generateDummyEntry("Re-Open"),
		data.filter(d => d._id=="In Progress")[0] || generateDummyEntry("In Progress"),
		data.filter(d => d._id=="Fixed")[0] || generateDummyEntry("Fixed"),
		data.filter(d => d._id=="Ready for QA")[0] || generateDummyEntry("Ready for QA"),
		data.filter(d => d._id=="Ready for I&T")[0] || generateDummyEntry("Ready for I&T"),
		data.filter(d => d._id=="Ready for Release")[0] || generateDummyEntry("Ready for Release"),
		data.filter(d => d._id=="Closed")[0] || generateDummyEntry("Closed"),
		data.filter(d => d._id=="Cannot Reproduce")[0] || generateDummyEntry("Cannot Reproduce"),
		data.filter(d => d._id=="Configuration Issue")[0] || generateDummyEntry("Configuration Issue"),
		data.filter(d => d._id=="Duplicate")[0] || generateDummyEntry("Duplicate"),
		data.filter(d => d._id=="Rejected")[0] || generateDummyEntry("Rejected"),
		data.filter(d => d._id=="Working as Expected")[0] || generateDummyEntry("Working as Expected"),
	];
	let i = 3;
	newData.forEach(d => {
		statusSummaryTable.appendChild(generateStatusSummaryRow(statusClassMapper[d._id], i, d._id, d));
		i += 1;
	})
}

function generateStatusSummaryRow(css, rowCounter, text, values){
	let keys = ["count", "highest", "high", "medium", "low", "lowest"];
	let row = document.createElement("tr");
	row.setAttribute("class", `summary_${rowCounter}`);
	let data = document.createElement("td");
	let button = document.createElement("button");
	let clone_text = data.cloneNode();
	row.appendChild(clone_text);
	clone_text.setAttribute("class", `${css} tableButton`);
	clone_text.appendChild(document.createTextNode(text))
	clone_text.setAttribute("onclick", `filterTable("status_${css}", "priority_count")`)
	let counter = 0;
	keys.forEach(k => {
		let clone = data.cloneNode();
		row.appendChild(clone);
		if(values[k] == 0) clone.setAttribute("class", `summary_${rowCounter}_${counter} cellDisabled`);
		else if(keys.indexOf(values[k]) != -1) {
			clone.setAttribute("class", `summary_${rowCounter}_${counter} tableButton leaveIt`);
			clone.setAttribute("onclick", `filterTable("status_${css}", "priority_${k}")`)
		}
		else {
			clone.setAttribute("class", `summary_${rowCounter}_${counter} tableButton ${values[k]}`);
			clone.setAttribute("onclick", `filterTable("status_${css}", "priority_${k}")`)
		}
		clone.setAttribute("onmouseenter", `summaryTableCellOnMouseEnter(this)`);
		clone.setAttribute("onmouseleave", `summaryTableCellOnMouseLeave(this)`);
		counter += 1;
		clone.appendChild(document.createTextNode(values[k]))
	});
	return row
}

function getDevTeamDefectStatusAggregation(){
	let aggregationPipeline = [{"$match":{"releaseVersion._id": RELEASE,"status":{"$in":["Open","Re-Open","In Progress"]}}},{"$group":{"_id":"$assignedTo._id","count":{"$sum":1},"high":{"$sum":{"$cond":{"else":0,"if":{"$eq":["$priority","High"]},"then":1}}},"highest":{"$sum":{"$cond":{"else":0,"if":{"$eq":["$priority","Highest"]},"then":1}}},"low":{"$sum":{"$cond":{"else":0,"if":{"$eq":["$priority","Low"]},"then":1}}},"lowest":{"$sum":{"$cond":{"else":0,"if":{"$eq":["$priority","Lowest"]},"then":1}}},"medium":{"$sum":{"$cond":{"else":0,"if":{"$eq":["$priority","Medium"]},"then":1}}}}},{"$sort":{"_id":1}}]
	apiCaller("POST", "/api/c/data-stack/defects/utils/aggregate", null, null, aggregationPipeline, getDevTeamDefectStatusAggregationCB)
}

function getDevTeamDefectStatusAggregationCB(data) {
	console.log(data);
}

let originalStyle = null
function summaryTableCellOnMouseEnter(cellRef){
	let cellClass = cellRef.getAttribute("class");
	let styles = cellClass.split(" ")[0].split("_");
	let rowClass = `${styles[0]}_${styles[1]}`;
	originalStyle = cellClass;
	d.c(rowClass)[0].style.backgroundColor = "powderblue";
	let cell = d.c(cellClass)[0];
	if(cellClass.indexOf("tableButton") != -1 && cellClass.indexOf("leaveIt") == -1) {
		cell.style.backgroundColor = "steelblue";
		cell.style.color = "white";
	}
}

function summaryTableCellOnMouseLeave(cellRef){
	let cellClass = cellRef.getAttribute("class");
	let styles = cellClass.split(" ")[0].split("_");
	let rowClass = `${styles[0]}_${styles[1]}`;
	d.c(rowClass)[0].style.backgroundColor = "white";
	let cell = d.c(cellClass)[0]
	if(cellClass.indexOf("tableButton") != -1 && cellClass.indexOf("leaveIt") == -1) {
		cell.style.backgroundColor = "white";
		cell.style.color = "black";
	}
	cell.setAttribute("class",  originalStyle);
}

function showAll(className){
	Array.from(d.c(className)).forEach(elem => elem.style.display = "table-row")
}

function hideAll(className){
	Array.from(d.c(className)).forEach(elem => elem.style.display = "none");
}

function hideInvalid(){
	status_classes.forEach(s => showAll(s))
	priority_classes.forEach(p => showAll(p));
	default_hidden_classes.forEach(s => hideAll(s));
}

function filterTable(status, priority){
	status_classes.forEach(s => showAll(s))
	priority_classes.forEach(p => showAll(p));
	if(status != "status_statusAll") status_classes.filter(s => s != status).forEach(s => hideAll(s));
	if(priority != "priority_count") priority_classes.filter(p => p != priority).forEach(p => hideAll(p))
}

function generateSummaryRow(css, text, value){
	let row = document.createElement("tr");
	let data = document.createElement("td");
	let clone1 = data.cloneNode();
	let clone2 = data.cloneNode();
	row.appendChild(clone1);
	row.appendChild(clone2);
	clone1.setAttribute("class", css);
	clone1.appendChild(document.createTextNode(text))
	clone2.appendChild(document.createTextNode(value));
	return row
}

function generateDetailDev(key, value){
	let div = document.createElement("div");
	let divKey = document.createElement("div");
	divKey.setAttribute("class", "key");
	divKey.innerHTML = key;
	let divValue = document.createElement("div");
	divValue.setAttribute("class", "value");
	if(typeof value == "object" && value){
		let ol = document.createElement("ol")
		let li = document.createElement("li");
		value.forEach(v => {
			let clone = li.cloneNode();
			clone.innerHTML = v;
			ol.appendChild(clone);
		})
		divValue.appendChild(ol);
	}
	else divValue.innerHTML = value;
	if(key == "Priority") div.setAttribute("class", `${value.toLowerCase()}`);
	if(key == "Status") div.setAttribute("class", `${statusClassMapper[value]}`);
	div.appendChild(divKey);
	div.appendChild(divValue);
	return div;
}

var details = d.i("details");
details.innerHTML = "";
function showDetails(data){
	details.innerHTML = "";
	details.appendChild(generateDetailDev("ID", data._id));
	details.appendChild(generateDetailDev("Status", data.status));
	details.appendChild(generateDetailDev("Priority", data.priority));
	details.appendChild(generateDetailDev("Summary", data.summary));
	details.appendChild(generateDetailDev("Reported By", data.reportedBy._id));
	details.appendChild(generateDetailDev("Assigned To", data.assignedTo._id));
	details.appendChild(generateDetailDev("Description", data.description));
	details.appendChild(generateDetailDev("Comments", data.comments));
}

function generateFlexDataTableCell(id, d, status, priority) {
	let div = document.createElement("div");
	div.setAttribute("class", `${id} tableButton2 ${statusClassMapper[status]} status_${statusClassMapper[status]} priority_${priority.toLowerCase()}`)
	if(PRIORITY.indexOf(d.toLowerCase()) != -1)
		div.setAttribute("class", `${id} tableButton2 ${statusClassMapper[status]} status_${statusClassMapper[status]} priority_${priority.toLowerCase()} ${priority.toLowerCase()}`)
	div.setAttribute("onmouseenter", `flexDataMouseEnter("${id}")`);
	div.setAttribute("onmouseleave", `flexDataMouseLeave("${id}")`);
	div.addEventListener("click", () => apiCaller("GET", `/api/c/data-stack/defects/${id}`, null, null, null, showDetails));
	if(d.indexOf("@") == -1 ) div.innerHTML = d;
	else div.innerHTML = d.replace("@appveen.com", "");
	return div;
}

function flexDataMouseEnter(id){
	let elements = d.c(id);
	for(let i=0; i< elements.length; i++) {
		elements[i].setAttribute("style", "border: 1px solid black; box-shadow: 1px 1px 1px gray;");
	}
}

function flexDataMouseLeave(id){
	let elements = d.c(id);
	for(let i=0; i< elements.length; i++) {
		elements[i].setAttribute("style", "border: 1px solid white; box-shadow: 0 0 0 gray;");
	}
}

var flexDataTable = d.i("flexDataTable");
var flexDataColumn1 = d.i("flexDataColumn1");
var flexDataColumn2 = d.i("flexDataColumn2");
var flexDataColumn3 = d.i("flexDataColumn3");
var flexDataColumn4 = d.i("flexDataColumn4");
var flexDataColumn5 = d.i("flexDataColumn5");
var flexDataColumn6 = d.i("flexDataColumn6");
var flexDataColumn7 = d.i("flexDataColumn7");

function getDetectsCB(data){
	let tableHeaders = ["ID", "Summary", "Priority", "Status", "Assigned To", "Verified By", "Reported By"];
	let counter_priority = {
		"Highest": 0,
		"High": 0,
		"Medium": 0,
		"Low": 0,
		"Lowest": 0,
	};


	flexDataColumn1.innerHTML = `<div class="columnHeader">ID</div>`;
	flexDataColumn2.innerHTML = `<div class="columnHeader">Summary</div>`;
	flexDataColumn3.innerHTML = `<div class="columnHeader">Priority</div>`;
	flexDataColumn4.innerHTML = `<div class="columnHeader">Status</div>`;
	flexDataColumn5.innerHTML = `<div class="columnHeader">Assigned To</div>`;
	flexDataColumn6.innerHTML = `<div class="columnHeader">Verified By</div>`;
	flexDataColumn7.innerHTML = `<div class="columnHeader">Reported By</div>`;

	let div = document.createElement("div");
	data.forEach(d => {
		flexDataColumn1.appendChild(generateFlexDataTableCell(d._id, d._id, d.status, d.priority));
		flexDataColumn2.appendChild(generateFlexDataTableCell(d._id, d.summary, d.status, d.priority));
		flexDataColumn3.appendChild(generateFlexDataTableCell(d._id, d.priority, d.status, d.priority));
		flexDataColumn4.appendChild(generateFlexDataTableCell(d._id, d.status, d.status, d.priority));
		flexDataColumn5.appendChild(generateFlexDataTableCell(d._id, d.assignedTo?._id || "-nil-", d.status, d.priority));
		flexDataColumn6.appendChild(generateFlexDataTableCell(d._id, d.verifiedBy?._id || "-nil-", d.status, d.priority));
		flexDataColumn7.appendChild(generateFlexDataTableCell(d._id, d.reportedBy?._id || "-nil-", d.status, d.priority));
	});
	getDefectPriorityAggregation();
}