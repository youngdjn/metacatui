/*global define */
define(['jquery', 'underscore', 'backbone', 'uuid', 'md5', 'rdflib', 'models/SolrResult'],
	function($, _, Backbone, uuid, md5, rdf, SolrResult) {

	// Package Model
	// ------------------
	var PackageModel = Backbone.Model.extend(
    /** @lends PackageModel.prototype */{
		// This model contains information about a package/resource map
		defaults: function(){
			return {
				id: null, //The id of the resource map/package itself
				url: null, //the URL to retrieve this package
				memberId: null, //An id of a member of the data package
				indexDoc: null, //A SolrResult object representation of the resource map
				size: 0, //The number of items aggregated in this package
				totalSize: null,
				formattedSize: "",
				formatId: null,
				obsoletedBy: null,
				obsoletes: null,
				read_count_i: null,
				isPublic: true,
				members: [],
				memberIds: [],
				sources: [],
				derivations: [],
				provenanceFlag: null,
				sourcePackages: [],
				derivationPackages: [],
				sourceDocs: [],
				derivationDocs: [],
				relatedModels: [], //A condensed list of all SolrResult models related to this package in some way
				parentPackageMetadata: null,
				//If true, when the member objects are retrieved, archived content will be included
				getArchivedMembers: false,
			}
		},

		//Define the namespaces
        namespaces: {
			RDF:     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
			FOAF:    "http://xmlns.com/foaf/0.1/",
			OWL:     "http://www.w3.org/2002/07/owl#",
			DC:      "http://purl.org/dc/elements/1.1/",
			ORE:     "http://www.openarchives.org/ore/terms/",
			DCTERMS: "http://purl.org/dc/terms/",
			CITO:    "http://purl.org/spar/cito/",
			XML:     "http://www.w3.org/2001/XMLSchema#"
		},

		sysMetaNodeMap: {
			accesspolicy: "accessPolicy",
			accessrule: "accessRule",
			authoritativemembernode: "authoritativeMemberNode",
			dateuploaded: "dateUploaded",
			datesysmetadatamodified: "dateSysMetadataModified",
			dateuploaded: "dateUploaded",
			formatid: "formatId",
			nodereference: "nodeReference",
			obsoletedby: "obsoletedBy",
			originmembernode: "originMemberNode",
			replicamembernode: "replicaMemberNode",
			replicapolicy: "replicaPolicy",
			replicationstatus: "replicationStatus",
			replicaverified: "replicaVerified",
			rightsholder: "rightsHolder",
			serialversion: "serialVersion"
		},

		complete: false,

		pending: false,

		type: "Package",

		// The RDF graph representing this data package
        dataPackageGraph: null,

		initialize: function(options){
			this.setURL();

			// Create an initial RDF graph
            this.dataPackageGraph = rdf.graph();
		},

		setURL: function(){
			if(MetacatUI.appModel.get("packageServiceUrl"))
				this.set("url", MetacatUI.appModel.get("packageServiceUrl") + encodeURIComponent(this.get("id")));
		},

		/*
		 * Set the URL for fetch
		 */
		url: function(){
			return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id"));
		},

		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			this.pending = true;

			if((typeof id === "undefined") || !id) var id = this.memberId;

			var model = this;

			//Get the id of the resource map for this member
			var provFlList = MetacatUI.appSearchModel.getProvFlList() + "prov_instanceOfClass,";
			var query = 'fl=resourceMap,fileName,read:read_count_i,obsoletedBy,size,formatType,formatId,id,datasource,title,origin,pubDate,dateUploaded,isPublic,isService,serviceTitle,serviceEndpoint,serviceOutput,serviceDescription,' + provFlList +
						'&rows=1' +
						'&q=id:%22' + encodeURIComponent(id) + '%22' +
						'&wt=json';


			var requestSettings = {
				url: MetacatUI.appModel.get("queryServiceUrl") + query,
				success: function(data, textStatus, xhr) {
					//There should be only one response since we searched by id
					if(typeof data.response.docs !== "undefined"){
						var doc = data.response.docs[0];

						//Is this document a resource map itself?
						if(doc.formatId == "http://www.openarchives.org/ore/terms"){
							model.set("id", doc.id); //this is the package model ID
							model.set("members", new Array()); //Reset the member list
							model.getMembers();
						}
						//If there is no resource map, then this is the only document to in this package
						else if((typeof doc.resourceMap === "undefined") || !doc.resourceMap){
							model.set('id', null);
							model.set('memberIds', new Array(doc.id));
							model.set('members', [new SolrResult(doc)]);
							model.trigger("change:members");
							model.flagComplete();
						}
						else{
							model.set('id', doc.resourceMap[0]);
							model.getMembers();
						}
					}
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		/* Get all the members of a resource map/package based on the id attribute of this model.
		 * Create a SolrResult model for each member and save it in the members[] attribute of this model. */
		getMembers: function(options){
			this.pending = true;

			var model   = this,
				members = [],
				pids    = []; //Keep track of each object pid

			//*** Find all the files that are a part of this resource map and the resource map itself
			var provFlList = MetacatUI.appSearchModel.getProvFlList();
			var query = 'fl=resourceMap,fileName,obsoletes,obsoletedBy,size,formatType,formatId,id,datasource,' +
							'rightsHolder,dateUploaded,archived,title,origin,prov_instanceOfClass,isDocumentedBy,isPublic' +
  						'&rows=1000' +
  						'&q=%28resourceMap:%22' + encodeURIComponent(this.id) + '%22%20OR%20id:%22' + encodeURIComponent(this.id) + '%22%29' +
  						'&wt=json';

			if( this.get("getArchivedMembers") ){
				query += "&archived=archived:*";
			}

			var requestSettings = {
				url: MetacatUI.appModel.get("queryServiceUrl") + query,
				success: function(data, textStatus, xhr) {

					//Separate the resource maps from the data/metadata objects
					_.each(data.response.docs, function(doc){
						if(doc.id == model.get("id")){
							model.set("indexDoc", doc);
							model.set(doc);
							if(model.get("resourceMap") && (options && options.getParentMetadata))
								model.getParentMetadata();
						}
						else{
							pids.push(doc.id);

							if(doc.formatType == "RESOURCE"){
								var newPckg = new PackageModel(doc);
								newPckg.set("parentPackage", model);
								members.push(newPckg);
							}
							else
								members.push(new SolrResult(doc));
						}
					});

					model.set('memberIds', _.uniq(pids));
					model.set('members', members);

					if(model.getNestedPackages().length > 0)
						model.createNestedPackages();
					else
						model.flagComplete();
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

			return this;
		},

		/*
		 * Send custom options to the Backbone.Model.fetch() function
		 */
		fetch: function(options){
			if(!options) var options = {};

			var fetchOptions = _.extend({dataType: "text"}, options);

            //Add the authorization options
            fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());


            return Backbone.Model.prototype.fetch.call(this, fetchOptions);
		},

		/*
         * Deserialize a Package from OAI-ORE RDF XML
         */
        parse: function(response, options) {

            //Save the raw XML in case it needs to be used later
            this.set("objectXML", $.parseHTML(response));

            //Define the namespaces
            var RDF =     rdf.Namespace(this.namespaces.RDF),
                FOAF =    rdf.Namespace(this.namespaces.FOAF),
                OWL =     rdf.Namespace(this.namespaces.OWL),
                DC =      rdf.Namespace(this.namespaces.DC),
                ORE =     rdf.Namespace(this.namespaces.ORE),
                DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
                CITO =    rdf.Namespace(this.namespaces.CITO);

            var memberStatements = [],
                memberURIParts,
                memberPIDStr,
                memberPID,
                memberModel,
                models = []; // the models returned by parse()

            try {
                rdf.parse(response, this.dataPackageGraph, MetacatUI.appModel.get("objectServiceUrl") + (encodeURIComponent(this.id) || encodeURIComponent(this.seriesid)), 'application/rdf+xml');

                // List the package members
                memberStatements = this.dataPackageGraph.statementsMatching(
                    undefined, ORE('aggregates'), undefined, undefined);

                var memberPIDs = [],
                	members = [],
                	currentMembers = this.get("members"),
                	model = this;

                // Get system metadata for each member to eval the formatId
                _.each(memberStatements, function(memberStatement){
                    memberURIParts = memberStatement.object.value.split('/');
                    memberPIDStr = _.last(memberURIParts);
                    memberPID = decodeURIComponent(memberPIDStr);

                    if ( memberPID ){
                    	memberPIDs.push(memberPID);

                    	//Get the current model from the member list, if it exists
                    	var existingModel = _.find(currentMembers, function(m){
                    		return m.get("id") == decodeURIComponent(memberPID);
                    	});

                    	//Add the existing model to the new member list
                    	if(existingModel){
                    		members.push(existingModel);
                    	}
                    	//Or create a new SolrResult model
                    	else{
                    		members.push(new SolrResult({
                    			id: decodeURIComponent(memberPID)
                    		}));
                    	}
                    }

                }, this);

                //Get the documents relationships
                var documentedByStatements = this.dataPackageGraph.statementsMatching(
                        undefined, CITO('isDocumentedBy'), undefined, undefined),
                    metadataPids = [];

                _.each(documentedByStatements, function(statement){
                	//Get the data object that is documentedBy metadata
                	var dataPid = decodeURIComponent(_.last(statement.subject.value.split('/'))),
                		dataObj = _.find(members, function(m){ return (m.get("id") == dataPid) }),
                		metadataPid = _.last(statement.object.value.split('/'));

                	//Save this as a metadata model
                	metadataPids.push(metadataPid);

                	//Set the isDocumentedBy field
                	var isDocBy = dataObj.get("isDocumentedBy");
                	if(isDocBy && Array.isArray(isDocBy)) isDocBy.push(metadataPid);
                	else if(isDocBy && !Array.isArray(isDocBy)) isDocBy = [isDocBy, metadataPid];
                	else isDocBy = [metadataPid];

                	dataObj.set("isDocumentedBy", isDocBy);
                }, this);

                //Get the metadata models and mark them as metadata
                var metadataModels = _.filter(members, function(m){ return _.contains(metadataPids, m.get("id")) });
                _.invoke(metadataModels, "set", "formatType", "METADATA");

                //Keep the pids in the collection for easy access later
                this.set("memberIds", memberPIDs);
                this.set("members", members);

            } catch (error) {
                console.log(error);
            }
            return models;
        },


		/*
		 * Overwrite the Backbone.Model.save() function to set custom options
		 */
		save: function(attrs, options){
			if(!options) var options = {};

			//Get the system metadata first
			if(!this.get("hasSystemMetadata")){
				var model = this;
				var requestSettings = {
						url: MetacatUI.appModel.get("metaServiceUrl") + encodeURIComponent(this.get("id")),
						success: function(response){
							model.parseSysMeta(response);

							model.set("hasSystemMetadata", true);
							model.save.call(model, null, options);
						},
						dataType: "text"
				}
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
				return;
			}

			//Create a new pid if we are updating the object
			if(!options.sysMetaOnly){
				//Set a new id
				var oldPid = this.get("id");
				this.set("oldPid", oldPid);
				this.set("id", "urn:uuid:" + uuid.v4());
				this.set("obsoletes", oldPid);
				this.set("obsoletedBy", null);
				this.set("archived", false);
			}

			//Create the system metadata
			var sysMetaXML = this.serializeSysMeta();

			//Send the new pid, old pid, and system metadata
			var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});
			var formData = new FormData();
			formData.append("sysmeta", xmlBlob, "sysmeta");

			//Let's try updating the system metadata for now
			if(options.sysMetaOnly){
				formData.append("pid", this.get("id"));

				var requestSettings = {
						url: MetacatUI.appModel.get("metaServiceUrl"),
						type: "PUT",
						cache: false,
					    contentType: false,
					    processData: false,
						data: formData,
						success: function(response){
						},
						error: function(data){
							console.log("error updating system metadata");
						}
				}
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			}
			else{
				//Add the ids to the form data
				formData.append("newPid", this.get("id"));
				formData.append("pid", oldPid);

				//Create the resource map XML
				var mapXML = this.serialize();
				var mapBlob = new Blob([mapXML], {type : 'application/xml'});
				formData.append("object", mapBlob);

				//Get the size of the new resource map
				this.set("size", mapBlob.size);

				//Get the new checksum of the resource map
				var checksum = md5(mapXML);
				this.set("checksum", checksum);

				var requestSettings = {
						url: MetacatUI.appModel.get("objectServiceUrl"),
						type: "PUT",
						cache: false,
						contentType: false,
						processData: false,
						data: formData,
						success: function(response){
						},
						error: function(data){
							console.log("error udpating object");
						}
				}
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			}
		},

		parseSysMeta: function(response){
        	this.set("sysMetaXML", $.parseHTML(response));

    		var responseDoc = $.parseHTML(response),
    			systemMetadata,
    			prependXML = "",
    			appendXML = "";

    		for(var i=0; i<responseDoc.length; i++){
    			if((responseDoc[i].nodeType == 1) && (responseDoc[i].localName.indexOf("systemmetadata") > -1))
    				systemMetadata = responseDoc[i];
    		}

    		//Parse the XML to JSON
    		var sysMetaValues = this.toJson(systemMetadata),
    			camelCasedValues = {};
    		//Convert the JSON to a camel-cased version, which matches Solr and is easier to work with in code
    		_.each(Object.keys(sysMetaValues), function(key){
    			camelCasedValues[this.sysMetaNodeMap[key]] = sysMetaValues[key];
    		}, this);

    		//Set the values on the model
    		this.set(camelCasedValues);
        },

        serialize: function(){
        	//Create an RDF serializer
        	var serializer = rdf.Serializer();
        	serializer.store = this.dataPackageGraph;

        	//Define the namespaces
            var ORE  = rdf.Namespace(this.namespaces.ORE),
            	CITO = rdf.Namespace(this.namespaces.CITO);

        	//Get the pid of this package - depends on whether we are updating or creating a resource map
            var pid = this.get("id"),
            	oldPid = this.get("oldPid"),
            	updating = oldPid? true : false;

            //Update the pids in the RDF graph only if we are updating the resource map with a new pid
            if(updating){

            	//Find the identifier statement in the resource map
				var idNode =  rdf.lit(oldPid),
					idStatement = this.dataPackageGraph.statementsMatching(undefined, undefined, idNode);

				//Get the CN Resolve Service base URL from the resource map (mostly important in dev environments where it will not always be cn.dataone.org)
				var	cnResolveUrl = idStatement[0].subject.value.substring(0, idStatement[0].subject.value.indexOf(oldPid));
				this.dataPackageGraph.cnResolveUrl = cnResolveUrl;

				//Create variations of the resource map ID using the resolve URL so we can always find it in the RDF graph
	            var	oldPidVariations = [oldPid, encodeURIComponent(oldPid), cnResolveUrl+ encodeURIComponent(oldPid)];

            	//Get all the isAggregatedBy statements
	            var aggregationNode =  rdf.sym(cnResolveUrl + encodeURIComponent(oldPid) + "#aggregation"),
	            	aggByStatements = this.dataPackageGraph.statementsMatching(undefined, ORE("isAggregatedBy"));

	            //Using the isAggregatedBy statements, find all the DataONE object ids in the RDF graph
	            var idsFromXML = [];
	            _.each(aggByStatements, function(statement){

	            	//Check if the resource map ID is the old existing id, so we don't collect ids that are not about this resource map
	            	if(_.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) })){
	            		var statementID = statement.subject.value;
	            		idsFromXML.push(statementID);

	            		//Add variations of the ID so we make sure we account for all the ways they exist in the RDF XML
	            		if(statementID.indexOf(cnResolveUrl) > -1)
	            			idsFromXML.push(statementID.substring(statementID.lastIndexOf("/") + 1));
		            	else
		            		idsFromXML.push(cnResolveUrl + encodeURIComponent(statementID));
	            	}

	            }, this);

	            //Get all the ids from this model
            	var idsFromModel = _.invoke(this.get("members"), "get", "id");

		        //Find the difference between the model IDs and the XML IDs to get a list of added members
	            var addedIds  = _.without(_.difference(idsFromModel, idsFromXML), oldPidVariations);
	            //Create variations of all these ids too
	            var allMemberIds = idsFromModel;
	            _.each(idsFromModel, function(id){
	            	allMemberIds.push(cnResolveUrl + encodeURIComponent(id));
	           	});

            	//Remove any other isAggregatedBy statements that are not listed as members of this model
	            _.each(aggByStatements, function(statement){
	            	if(!_.contains(allMemberIds, statement.subject.value))
	            		this.removeFromAggregation(statement.subject.value);
	            	else if(_.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) }))
	            		statement.object.value = cnResolveUrl+ encodeURIComponent(pid) + "#aggregation";
	            }, this);

            	//Change all the statements in the RDF where the aggregation is the subject, to reflect the new resource map ID
	            var aggregationSubjStatements = this.dataPackageGraph.statementsMatching(aggregationNode);
	            _.each(aggregationSubjStatements, function(statement){
	            	statement.subject.value = cnResolveUrl + encodeURIComponent(pid) + "#aggregation";
	            });

            	//Change all the statements in the RDF where the aggregation is the object, to reflect the new resource map ID
	            var aggregationObjStatements = this.dataPackageGraph.statementsMatching(undefined, undefined, aggregationNode);
	            _.each(aggregationObjStatements, function(statement){
	            	statement.object.value = cnResolveUrl+ encodeURIComponent(pid) + "#aggregation";
	            });

				//Change all the resource map subject nodes in the RDF graph
				var rMapNode =  rdf.sym(cnResolveUrl + encodeURIComponent(oldPid));
			    var rMapStatements = this.dataPackageGraph.statementsMatching(rMapNode);
			    _.each(rMapStatements, function(statement){
			    	statement.subject.value = cnResolveUrl + encodeURIComponent(pid);
			    });

			    //Change the idDescribedBy statement
			    var isDescribedByStatements = this.dataPackageGraph.statementsMatching(undefined, ORE("isDescribedBy"), rdf.sym(oldPid));
			    if(isDescribedByStatements[0])
			    	isDescribedByStatements[0].object.value = pid;

            	//Add nodes for new package members
            	_.each(addedIds, function(id){
            		this.addToAggregation(id);
            	}, this);

			    //Change all the resource map identifier literal node in the RDF graph
				if(idStatement[0]) idStatement[0].object.value = pid;

            }

            //Now serialize the RDF XML
            var serializer = rdf.Serializer();
            serializer.store = this.dataPackageGraph;

            var xmlString = serializer.statementsToXML(this.dataPackageGraph.statements);

        	return xmlString;
        },

        serializeSysMeta: function(){
        	//Get the system metadata XML that currently exists in the system
        	var xml = $(this.get("sysMetaXML"));

        	//Update the system metadata values
        	xml.find("serialversion").text(this.get("serialVersion") || "0");
        	xml.find("identifier").text((this.get("newPid") || this.get("id")));
        	xml.find("formatid").text(this.get("formatId"));
        	xml.find("size").text(this.get("size"));
        	xml.find("checksum").text(this.get("checksum"));
        	xml.find("submitter").text(this.get("submitter") || MetacatUI.appUserModel.get("username"));
        	xml.find("rightsholder").text(this.get("rightsHolder") || MetacatUI.appUserModel.get("username"));
        	xml.find("archived").text(this.get("archived"));
        	xml.find("dateuploaded").text(this.get("dateUploaded") || new Date().toISOString());
        	xml.find("datesysmetadatamodified").text(this.get("dateSysMetadataModified") || new Date().toISOString());
        	xml.find("originmembernode").text(this.get("originMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));
        	xml.find("authoritativemembernode").text(this.get("authoritativeMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));

        	if(this.get("obsoletes"))
        		xml.find("obsoletes").text(this.get("obsoletes"));
        	else
        		xml.find("obsoletes").remove();

        	if(this.get("obsoletedBy"))
        		xml.find("obsoletedby").text(this.get("obsoletedBy"));
        	else
        		xml.find("obsoletedby").remove();

        	//Write the access policy
        	var accessPolicyXML = '<accessPolicy>\n';
        	_.each(this.get("accesspolicy"), function(policy, policyType, all){
    			var fullPolicy = all[policyType];

    			_.each(fullPolicy, function(policyPart){
    				accessPolicyXML += '\t<' + policyType + '>\n';

        			accessPolicyXML += '\t\t<subject>' + policyPart.subject + '</subject>\n';

        			var permissions = Array.isArray(policyPart.permission)? policyPart.permission : [policyPart.permission];
        			_.each(permissions, function(perm){
        				accessPolicyXML += '\t\t<permission>' + perm + '</permission>\n';
            		});

        			accessPolicyXML += '\t</' + policyType + '>\n';
    			});
        	});
        	accessPolicyXML += '</accessPolicy>';

        	//Replace the old access policy with the new one
        	xml.find("accesspolicy").replaceWith(accessPolicyXML);

        	var xmlString = $(document.createElement("div")).append(xml.clone()).html();

        	//Now camel case the nodes
        	_.each(Object.keys(this.sysMetaNodeMap), function(name, i, allNodeNames){
        		var regEx = new RegExp("<" + name, "g");
        		xmlString = xmlString.replace(regEx, "<" + this.sysMetaNodeMap[name]);
        		var regEx = new RegExp(name + ">", "g");
        		xmlString = xmlString.replace(regEx, this.sysMetaNodeMap[name] + ">");
        	}, this);

        	xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");

        	return xmlString;
        },

        //Adds a new object to the resource map RDF graph
        addToAggregation: function(id){
        	if(id.indexOf(this.dataPackageGraph.cnResolveUrl) < 0)
        		var fullID = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
        	else{
        		var fullID = id;
        		id = id.substring(this.dataPackageGraph.cnResolveUrl.lastIndexOf("/") + 1);
        	}

        	//Initialize the namespaces
        	var ORE     = rdf.Namespace(this.namespaces.ORE),
        		DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
        		XML     = rdf.Namespace(this.namespaces.XML),
        		CITO    = rdf.Namespace(this.namespaces.CITO);

        	//Create a node for this object, the identifier, the resource map, and the aggregation
        	var objectNode = rdf.sym(fullID),
        		mapNode    = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.get("id"))),
        		aggNode    = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.get("id")) + "#aggregation"),
        		idNode     = rdf.literal(id, undefined, XML("string"));

        	//Add the statement: this object isAggregatedBy the resource map aggregation
			this.dataPackageGraph.addStatement(rdf.st(objectNode, ORE("isAggregatedBy"), aggNode));
			//Add the statement: The resource map aggregation aggregates this object
			this.dataPackageGraph.addStatement(rdf.st(aggNode, ORE("aggregates"), objectNode));
			//Add the statement: This object has the identifier {id}
			this.dataPackageGraph.addStatement(rdf.st(objectNode, DCTERMS("identifier"), idNode));

			//Find the metadata doc that describes this object
			var model   = _.find(this.get("members"), function(m){ return m.get("id") == id }),
				isDocBy = model.get("isDocumentedBy");

			//If this object is documented by any metadata...
			if(isDocBy){
				//Get the ids of all the metadata objects in this package
				var	metadataInPackage = _.compact(_.map(this.get("members"), function(m){ if(m.get("formatType") == "METADATA") return m.get("id"); }));
				//Find the metadata IDs that are in this package that also documents this data object
				var metadataIds = Array.isArray(isDocBy)? _.intersection(metadataInPackage, isDocBy) : _.intersection(metadataInPackage, [isDocBy]);

				//For each metadata that documents this object, add a CITO:isDocumentedBy and CITO:documents statement
				_.each(metadataIds, function(metaId){
					//Create the named nodes and statements
					var memberNode       = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id)),
						metadataNode     = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(metaId)),
						isDocByStatement = rdf.st(memberNode, CITO("isDocumentedBy"), metadataNode),
						documentsStatement = rdf.st(metadataNode, CITO("documents"), memberNode);
					//Add the statements
					this.dataPackageGraph.addStatement(isDocByStatement);
					this.dataPackageGraph.addStatement(documentsStatement);
				}, this);
			}
        },

        removeFromAggregation: function(id){
        	if(!id.indexOf(this.dataPackageGraph.cnResolveUrl)) id = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);

        	var removedObjNode = rdf.sym(id),
        		statements = _.union(this.dataPackageGraph.statementsMatching(undefined, undefined, removedObjNode),
        						this.dataPackageGraph.statementsMatching(removedObjNode));

			this.dataPackageGraph.removeStatements(statements);
        },

		getParentMetadata: function(){
			var rMapIds = this.get("resourceMap");

			//Create a query that searches for any resourceMap with an id matching one of the parents OR an id that matches one of the parents.
			//This will return all members of the parent resource maps AND the parent resource maps themselves
			var rMapQuery = "",
				idQuery = "";
			if(Array.isArray(rMapIds) && (rMapIds.length > 1)){
				_.each(rMapIds, function(id, i, ids){

					//At the begininng of the list of ids
					if(rMapQuery.length == 0){
						rMapQuery += "resourceMap:(";
						idQuery += "id:(";
					}

					//The id
					rMapQuery += "%22" + encodeURIComponent(id) + "%22";
					idQuery   += "%22" + encodeURIComponent(id) + "%22";

					//At the end of the list of ids
					if(i+1 == ids.length){
						rMapQuery += ")";
						idQuery += ")";
					}
					//In-between each id
					else{
						rMapQuery += " OR ";
						idQuery += " OR ";
					}
				});
			}
			else{
				//When there is just one parent, the query is simple
				var rMapId = Array.isArray(rMapIds)? rMapIds[0] : rMapIds;
				rMapQuery += "resourceMap:%22" + encodeURIComponent(rMapId) + "%22";
				idQuery   += "id:%22" + encodeURIComponent(rMapId) + "%22";
			}
			var query = "fl=title,id,obsoletedBy,resourceMap" +
						"&wt=json" +
						"&group=true&group.field=formatType&group.limit=-1" +
						"&q=((formatType:METADATA AND " + rMapQuery + ") OR " + idQuery + ")";

			var model = this;
			var requestSettings = {
				url: MetacatUI.appModel.get("queryServiceUrl") + query,
				success: function(data, textStatus, xhr) {
					var results = data.grouped.formatType.groups,
							resourceMapGroup = _.where(results, { groupValue: "RESOURCE" })[0],
						rMapList = resourceMapGroup? resourceMapGroup.doclist : null,
						rMaps = rMapList? rMapList.docs : [],
						rMapIds = _.pluck(rMaps, "id"),
						parents = [],
						parentIds = [];

					//As long as this map isn't obsoleted by another map in our results list, we will show it
					_.each(rMaps, function(map){
						if(! (map.obsoletedBy && _.contains(rMapIds, map.obsoletedBy))){
							parents.push(map);
							parentIds.push(map.id);
						}
					});

					var metadataList =  _.where(results, {groupValue: "METADATA"})[0],
						metadata = (metadataList && metadataList.doclist)? metadataList.doclist.docs : [],
						metadataModels = [];

            //As long as this map isn't obsoleted by another map in our results list, we will show it
  					_.each(metadata, function(m){

              //Find the metadata doc that obsoletes this one
              var isObsoletedBy = _.findWhere(metadata, { id: m.obsoletedBy });

              //If one isn't found, then this metadata doc is the most recent
  						if(typeof isObsoletedBy == "undefined"){
                //If this metadata doc is in one of the filtered parent resource maps
    						if(_.intersection(parentIds, m.resourceMap).length){
                  //Create a SolrResult model and add to an array
    							metadataModels.push(new SolrResult(m));
                }
  						}
  					});

					model.set("parentPackageMetadata", metadataModels);
					model.trigger("change:parentPackageMetadata");
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		//Create the URL string that is used to download this package
		getURL: function(){
			var url = null;

			//If we haven't set a packageServiceURL upon app initialization and we are querying a CN, then the packageServiceURL is dependent on the MN this package is from
			if((MetacatUI.appModel.get("d1Service").toLowerCase().indexOf("cn/") > -1) && MetacatUI.nodeModel.get("members").length){
				var source = this.get("datasource"),
					node   = _.find(MetacatUI.nodeModel.get("members"), {identifier: source});

				//If this node has MNRead v2 services...
				if(node && node.readv2)
					url = node.baseURL + "/v2/packages/application%2Fbagit-097/" + encodeURIComponent(this.get("id"));
			}
			else if(MetacatUI.appModel.get("packageServiceUrl"))
				url = MetacatUI.appModel.get("packageServiceUrl") + encodeURIComponent(this.get("id"));

			this.set("url", url);
			return url;
		},

		createNestedPackages: function(){
			var parentPackage = this,
			    nestedPackages = this.getNestedPackages(),
					numNestedPackages = nestedPackages.length,
					numComplete = 0;

			_.each(nestedPackages, function(nestedPackage, i, nestedPackages){

				//Flag the parent model as complete when all the nested package info is ready
				nestedPackage.on("complete", function(){
					numComplete++;

					//This is the last package in this package - finish up details and flag as complete
					if(numNestedPackages == numComplete){
						var sorted = _.sortBy(parentPackage.get("members"), function(p){ return p.get("id") });
						parentPackage.set("members", sorted);
						parentPackage.flagComplete();
					}
				});

				//Only look one-level deep at all times to avoid going down a rabbit hole
				if( nestedPackage.get("parentPackage") && nestedPackage.get("parentPackage").get("parentPackage") ){
					nestedPackage.flagComplete();
					return;
				}
				else{
					//Get the members of this nested package
					nestedPackage.getMembers();
				}

			});
		},

		getNestedPackages: function(){
			return _.where(this.get("members"), {type: "Package"});
		},

		getMemberNames: function(){
			var metadata = this.getMetadata();
			if(!metadata) return false;

			//Load the rendered metadata from the view service
			var viewService = MetacatUI.appModel.get("viewServiceUrl") + encodeURIComponent(metadata.get("id"));
			var requestSettings = {
					url: viewService,
					success: function(data, response, xhr){
						if(solrResult.get("formatType") == "METADATA")
							entityName = solrResult.get("title");
						else{
							var container = viewRef.findEntityDetailsContainer(solrResult.get("id"));
							if(container && container.length > 0){
								var entityName = $(container).find(".entityName").attr("data-entity-name");
								if((typeof entityName === "undefined") || (!entityName)){
									entityName = $(container).find(".control-label:contains('Entity Name') + .controls-well").text();
									if((typeof entityName === "undefined") || (!entityName))
										entityName = null;
								}
							}
							else
								entityName = null;

						}
					}
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		/*
		 * Will query for the derivations of this package, and sort all entities in the prov trace
		 * into sources and derivations.
		 */
		getProvTrace: function(){
			var model = this;

			//See if there are any prov fields in our index before continuing
			if(!MetacatUI.appSearchModel.getProvFields()) return this;

			//Start keeping track of the sources and derivations
			var sources 		   = new Array(),
				derivations 	   = new Array();

			//Search for derivations of this package
			var derivationsQuery = MetacatUI.appSearchModel.getGroupedQuery("prov_wasDerivedFrom",
					_.map(this.get("members"), function(m){ return m.get("id"); }), "OR") +
					"%20-obsoletedBy:*";

			var requestSettings = {
					url: MetacatUI.appModel.get("queryServiceUrl") + "&q=" + derivationsQuery + "&wt=json&rows=1000" +
						 "&fl=id,resourceMap,documents,isDocumentedBy,prov_wasDerivedFrom",
					success: function(data){
						_.each(data.response.docs, function(result){
							derivations.push(result.id);
						});

						//Make arrays of unique IDs of objects that are sources or derivations of this package.
						_.each(model.get("members"), function(member, i){
							if(member.type == "Package") return;

							if(member.hasProvTrace()){
								sources 	= _.union(sources, member.getSources());
								derivations = _.union(derivations, member.getDerivations());
							}
						});

						//Save the arrays of sources and derivations
						model.set("sources", sources);
						model.set("derivations", derivations);

						//Now get metadata about all the entities in the prov trace not in this package
						model.getExternalProvTrace();
					}
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getExternalProvTrace: function(){
			var model = this;

			//Compact our list of ids that are in the prov trace by combining the sources and derivations and removing ids of members of this package
			var externalProvEntities = _.difference(_.union(this.get("sources"), this.get("derivations")), this.get("memberIds"));

			//If there are no sources or derivations, then we do not need to find resource map ids for anything
			if(!externalProvEntities.length){

				//Save this prov trace on a package-member/document/object level.
				if(this.get("sources").length || this.get("derivations").length)
					this.setMemberProvTrace();

				//Flag that the provenance trace is complete
				this.set("provenanceFlag", "complete");

				return this;
			}
			else{
				//Create a query where we retrieve the ID of the resource map of each source and derivation
				var idQuery = MetacatUI.appSearchModel.getGroupedQuery("id", externalProvEntities, "OR");

				//Create a query where we retrieve the metadata for each source and derivation
				var metadataQuery = MetacatUI.appSearchModel.getGroupedQuery("documents", externalProvEntities, "OR");
			}

			//TODO: Find the products of programs/executions

			//Make a comma-separated list of the provenance field names
			var provFieldList = "";
			_.each(MetacatUI.appSearchModel.getProvFields(), function(fieldName, i, list){
				provFieldList += fieldName;
				if(i < list.length-1) provFieldList += ",";
			});

			//Combine the two queries with an OR operator
			if(idQuery.length && metadataQuery.length) var combinedQuery = idQuery + "%20OR%20" + metadataQuery;
			else return this;

			//the full and final query in Solr syntax
			var query = "q=" + combinedQuery +
						"&fl=id,resourceMap,documents,isDocumentedBy,formatType,formatId,dateUploaded,rightsHolder,datasource,prov_instanceOfClass," +
						provFieldList +
						"&rows=100&wt=json";

			//Send the query to the query service
			var requestSettings = {
				url: MetacatUI.appModel.get("queryServiceUrl") + query,
				success: function(data, textStatus, xhr){

					//Do any of our docs have multiple resource maps?
					var hasMultipleMaps = _.filter(data.response.docs, function(doc){
						return((typeof doc.resourceMap !== "undefined") && (doc.resourceMap.length > 1))
						});
					//If so, we want to find the latest version of each resource map and only represent that one in the Prov Chart
					if(typeof hasMultipleMaps !== "undefined"){
						var allMapIDs = _.uniq(_.flatten(_.pluck(hasMultipleMaps, "resourceMap")));
						if(allMapIDs.length){

							var query = "q=+-obsoletedBy:*+" + MetacatUI.appSearchModel.getGroupedQuery("id", allMapIDs, "OR") +
										"&fl=obsoletes,id" +
										"&wt=json";
							var requestSettings = {
								url: MetacatUI.appModel.get("queryServiceUrl") + query,
								success: function(mapData, textStatus, xhr){

									//Create a list of resource maps that are not obsoleted by any other resource map retrieved
									var resourceMaps = mapData.response.docs;

									model.obsoletedResourceMaps = _.pluck(resourceMaps, "obsoletes");
									model.latestResourceMaps    = _.difference(resourceMaps, model.obsoletedResourceMaps);

									model.sortProvTrace(data.response.docs);
								}
							}
							$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
						}
						else
							model.sortProvTrace(data.response.docs);
					}
					else
						model.sortProvTrace(data.response.docs);

				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

			return this;
		},

		sortProvTrace: function(docs){
			var model = this;

			//Start an array to hold the packages in the prov trace
			var sourcePackages   = new Array(),
				derPackages      = new Array(),
				sourceDocs		 = new Array(),
				derDocs	 		 = new Array(),
				sourceIDs        = this.get("sources"),
				derivationIDs    = this.get("derivations");

			//Separate the results into derivations and sources and group by their resource map.
			_.each(docs, function(doc, i){

				var docModel = new SolrResult(doc),
				      mapIds = docModel.get("resourceMap");


				if(((typeof mapIds === "undefined") || !mapIds) && (docModel.get("formatType") == "DATA") && ((typeof docModel.get("isDocumentedBy") === "undefined") || !docModel.get("isDocumentedBy"))){
					//If this object is not in a resource map and does not have metadata, it is a "naked" data doc, so save it by itself
					if(_.contains(sourceIDs, doc.id))
						sourceDocs.push(docModel);
					if(_.contains(derivationIDs, doc.id))
						derDocs.push(docModel);
				}
				else if(((typeof mapIds === "undefined") || !mapIds) && (docModel.get("formatType") == "DATA") && docModel.get("isDocumentedBy")){
					//If this data doc does not have a resource map but has a metadata doc that documents it, create a blank package model and save it
					var p = new PackageModel({
						members: new Array(docModel)
					});
					//Add this package model to the sources and/or derivations packages list
					if(_.contains(sourceIDs, docModel.get("id")))
						sourcePackages[docModel.get("id")] = p;
					if(_.contains(derivationIDs, docModel.get("id")))
						derPackages[docModel.get("id")] = p;
				}
				else if(mapIds.length){
					//If this doc has a resource map, create a package model and SolrResult model and store it
					var id     = docModel.get("id");

					//Some of these objects may have multiple resource maps
					_.each(mapIds, function(mapId, i, list){

						if(!_.contains(model.obsoletedResourceMaps, mapId)){
							var documentsSource, documentsDerivation;
							if(docModel.get("formatType") == "METADATA"){
								if(_.intersection(docModel.get("documents"), sourceIDs).length)     documentsSource = true;
								if(_.intersection(docModel.get("documents"), derivationIDs).length) documentsDerivation = true;
							}

							//Is this a source object or a metadata doc of a source object?
							if(_.contains(sourceIDs, id) || documentsSource){
								//Have we encountered this source package yet?
								if(!sourcePackages[mapId] && (mapId != model.get("id"))){
									//Now make a new package model for it
									var p = new PackageModel({
										id: mapId,
										members: new Array(docModel)
									});
									//Add to the array of source packages
									sourcePackages[mapId] = p;
								}
								//If so, add this member to its package model
								else if(mapId != model.get("id")){
									var memberList = sourcePackages[mapId].get("members");
									memberList.push(docModel);
									sourcePackages[mapId].set("members", memberList);
								}
							}

							//Is this a derivation object or a metadata doc of a derivation object?
							if(_.contains(derivationIDs, id) || documentsDerivation){
								//Have we encountered this derivation package yet?
								if(!derPackages[mapId] && (mapId != model.get("id"))){
									//Now make a new package model for it
									var p = new PackageModel({
										id: mapId,
										members: new Array(docModel)
									});
									//Add to the array of source packages
									derPackages[mapId] = p;
								}
								//If so, add this member to its package model
								else if(mapId != model.get("id")){
									var memberList = derPackages[mapId].get("members");
									memberList.push(docModel);
									derPackages[mapId].set("members", memberList);
								}
							}
						}
					});
				}
			});

			//Transform our associative array (Object) of packages into an array
			var newArrays = new Array();
			_.each(new Array(sourcePackages, derPackages, sourceDocs, derDocs), function(provObject){
				var newArray = new Array(), key;
				for(key in provObject){
					newArray.push(provObject[key]);
				}
				newArrays.push(newArray);
			});

			//We now have an array of source packages and an array of derivation packages.
			model.set("sourcePackages", newArrays[0]);
			model.set("derivationPackages", newArrays[1]);
			model.set("sourceDocs", newArrays[2]);
			model.set("derivationDocs", newArrays[3]);

			//Save this prov trace on a package-member/document/object level.
			model.setMemberProvTrace();

			//Flag that the provenance trace is complete
			model.set("provenanceFlag", "complete");
		},

		setMemberProvTrace: function(){
			var model = this,
				relatedModels = this.get("relatedModels"),
				relatedModelIDs = new Array();

			//Now for each doc, we want to find which member it is related to
			_.each(this.get("members"), function(member, i, members){
				if(member.type == "Package") return;

				//Get the sources and derivations of this member
				var memberSourceIDs = member.getSources();
				var memberDerIDs    = member.getDerivations();

				//Look through each source package, derivation package, source doc, and derivation doc.
				_.each(model.get("sourcePackages"), function(pkg, i){
					_.each(pkg.get("members"), function(sourcePkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberSourceIDs, sourcePkgMember.get("id")))
							//Save this source package member as a source of this member
							member.set("provSources", _.union(member.get("provSources"), [sourcePkgMember]));

						//Save this in the list of related models
						if(!_.contains(relatedModelIDs, sourcePkgMember.get("id"))){
							relatedModels.push(sourcePkgMember);
							relatedModelIDs.push(sourcePkgMember.get("id"));
						}
					});
				});
				_.each(model.get("derivationPackages"), function(pkg, i){
					_.each(pkg.get("members"), function(derPkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberDerIDs, derPkgMember.get("id")))
							//Save this derivation package member as a derivation of this member
							member.set("provDerivations", _.union(member.get("provDerivations"), [derPkgMember]));

						//Save this in the list of related models
						if(!_.contains(relatedModelIDs, derPkgMember.get("id"))){
							relatedModels.push(derPkgMember);
							relatedModelIDs.push(derPkgMember.get("id"));
						}
					});
				});
				_.each(model.get("sourceDocs"), function(doc, i){
					//Is this package member a direct source of this package member?
					if(_.contains(memberSourceIDs, doc.get("id")))
						//Save this source package member as a source of this member
						member.set("provSources", _.union(member.get("provSources"), [doc]));

					//Save this in the list of related models
					if(!_.contains(relatedModelIDs, doc.get("id"))){
						relatedModels.push(doc);
						relatedModelIDs.push(doc.get("id"));
					}
				});
				_.each(model.get("derivationDocs"), function(doc, i){
					//Is this package member a direct derivation of this package member?
					if(_.contains(memberDerIDs, doc.get("id")))
						//Save this derivation package member as a derivation of this member
						member.set("provDerivations", _.union(member.get("provDerivations"), [doc]));

					//Save this in the list of related models
					if(!_.contains(relatedModelIDs, doc.get("id"))){
						relatedModels.push(doc);
						relatedModelIDs.push(doc.get("id"));
					}
				});
				_.each(members, function(otherMember, i){
					//Is this other package member a direct derivation of this package member?
					if(_.contains(memberDerIDs, otherMember.get("id")))
						//Save this other derivation package member as a derivation of this member
						member.set("provDerivations", _.union(member.get("provDerivations"), [otherMember]));
					//Is this other package member a direct source of this package member?
					if(_.contains(memberSourceIDs, otherMember.get("id")))
						//Save this other source package member as a source of this member
						member.set("provSources", _.union(member.get("provSources"), [otherMember]));

					//Is this other package member an indirect source or derivation?
					if((otherMember.get("type") == "program") && (_.contains(member.get("prov_generatedByProgram"), otherMember.get("id")))){
						var indirectSources = _.filter(members, function(m){
							return _.contains(otherMember.getInputs(), m.get("id"));
						});
						indirectSourcesIds = _.each(indirectSources, function(m){ return m.get("id") });
						member.set("prov_wasDerivedFrom", _.union(member.get("prov_wasDerivedFrom"), indirectSourcesIds));
						//otherMember.set("prov_hasDerivations", _.union(otherMember.get("prov_hasDerivations"), [member.get("id")]));
						member.set("provSources", _.union(member.get("provSources"), indirectSources));
					}
					if((otherMember.get("type") == "program") && (_.contains(member.get("prov_usedByProgram"), otherMember.get("id")))){
						var indirectDerivations = _.filter(members, function(m){
							return _.contains(otherMember.getOutputs(), m.get("id"));
						});
						indirectDerivationsIds = _.each(indirectDerivations, function(m){ return m.get("id") });
						member.set("prov_hasDerivations", _.union(member.get("prov_hasDerivations"), indirectDerivationsIds));
						//otherMember.set("prov_wasDerivedFrom", _.union(otherMember.get("prov_wasDerivedFrom"), [member.get("id")]));
						member.set("provDerivations", _.union(member.get("provDerivations"), indirectDerivationsIds));
					}
				});

				//Add this member to the list of related models
				if(!_.contains(relatedModelIDs, member.get("id"))){
					relatedModels.push(member);
					relatedModelIDs.push(member.get("id"));
				}

				//Clear out any duplicates
				member.set("provSources", _.uniq(member.get("provSources")));
				member.set("provDerivations", _.uniq(member.get("provDerivations")));
			});

			//Update the list of related models
			this.set("relatedModels", relatedModels);

		},

		downloadWithCredentials: function(){
			//Get info about this object
			var	url = this.get("url"),
				  model = this;

			//Create an XHR
			var xhr = new XMLHttpRequest();
			xhr.withCredentials = true;

			//When the XHR is ready, create a link with the raw data (Blob) and click the link to download
			xhr.onload = function(){

        //Get the file name from the Content-Disposition header
        var filename = xhr.getResponseHeader('Content-Disposition');

        //As a backup, use the system metadata file name or the id
        if(!filename){
          filename = model.get("filename") || model.get("id");
        }

        //Add a ".zip" extension if it doesn't exist
  			if( filename.indexOf(".zip") < 0 || (filename.indexOf(".zip") != (filename.length-4)) ){
          filename += ".zip";
        }

			   //For IE, we need to use the navigator API
			   if (navigator && navigator.msSaveOrOpenBlob) {
				   navigator.msSaveOrOpenBlob(xhr.response, filename);
			   }
			   else{
					var a = document.createElement('a');
					a.href = window.URL.createObjectURL(xhr.response); // xhr.response is a blob
					a.download = filename; // Set the file name.
					a.style.display = 'none';
					document.body.appendChild(a);
					a.click();
					a.remove();
			   }

          // Track this event
          MetacatUI.analytics?.trackEvent("download", "Download Package", model.get("id"))

			    model.trigger("downloadComplete");
			};

			xhr.onprogress = function(e){
			    if (e.lengthComputable){
			        var percent = (e.loaded / e.total) * 100;
			        model.set("downloadPercent", percent);
			    }
			};

			xhr.onerror = function (e) {
				model.trigger("downloadError");

				// Track this event
				MetacatUI.analytics?.trackEvent(
					"download",
					"Download Package",
					model.get("id")
				);
				
			};
			//Open and send the request with the user's auth token
			xhr.open('GET', url);
			xhr.responseType = "blob";
			xhr.setRequestHeader("Authorization", "Bearer " + MetacatUI.appUserModel.get("token"));
			xhr.send();
		},

		/* Returns the SolrResult that represents the metadata doc */
		getMetadata: function(){
			var members = this.get("members");
			for(var i=0; i<members.length; i++){
				if(members[i].get("formatType") == "METADATA") return members[i];
			}

			//If there are no metadata objects in this package, make sure we have searched for them already
			if(!this.complete && !this.pending) this.getMembers();

			return false;
		},

		//Check authority of the Metadata SolrResult model instead
		checkAuthority: function(){

			//Call the auth service
			var authServiceUrl = MetacatUI.appModel.get('authServiceUrl');
			if(!authServiceUrl) return false;

			var model = this;

			var requestSettings = {
				url: authServiceUrl + encodeURIComponent(this.get("id")) + "?action=write",
				type: "GET",
				success: function(data, textStatus, xhr) {
					model.set("isAuthorized", true);
					model.trigger("change:isAuthorized");
				},
				error: function(xhr, textStatus, errorThrown) {
					model.set("isAuthorized", false);
				}
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		flagComplete: function(){
			this.complete = true;
			this.pending = false;
			this.trigger("complete", this);
		},


		    /*
		    * function xmlToJson - A utility function for converting XML to JSON
		    *
		    * @param xml {DOM Element} - An XML or HTML DOM element to convert to json
		    * @returns {object} - A literal JS object that represents the given XML
		    */
        toJson: function(xml) {

        	// Create the return object
        	var obj = {};

        	// do children
        	if (xml.hasChildNodes()) {
        		for(var i = 0; i < xml.childNodes.length; i++) {
        			var item = xml.childNodes.item(i);

        			//If it's an empty text node, skip it
        			if((item.nodeType == 3) && (!item.nodeValue.trim()))
        				continue;

        			//Get the node name
        			var nodeName = item.localName;

        			//If it's a new container node, convert it to JSON and add as a new object attribute
        			if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 1)) {
        				obj[nodeName] = this.toJson(item);
        			}
        			//If it's a new text node, just store the text value and add as a new object attribute
        			else if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 3)){
        				obj = item.nodeValue;
        			}
        			//If this node name is already stored as an object attribute...
        			else if(typeof(obj[nodeName]) != "undefined"){
        				//Cache what we have now
        				var old = obj[nodeName];
        				if(!Array.isArray(old))
        					old = [old];

        				//Create a new object to store this node info
        				var newNode = {};

        				//Add the new node info to the existing array we have now
    					if(item.nodeType == 1){
    						newNode = this.toJson(item);
    						var newArray = old.concat(newNode);
    					}
    					else if(item.nodeType == 3){
    						newNode = item.nodeValue;
    						var newArray = old.concat(newNode);
    					}

            			//Store the attributes for this node
            			_.each(item.attributes, function(attr){
            				newNode[attr.localName] = attr.nodeValue;
            			});

            			//Replace the old array with the updated one
    					obj[nodeName] = newArray;

    					//Exit
    					continue;
        			}

        			//Store the attributes for this node
        			/*_.each(item.attributes, function(attr){
        				obj[nodeName][attr.localName] = attr.nodeValue;
        			});*/

    			}

        	}
        	return obj;
        },

		//Sums up the byte size of each member
		getTotalSize: function(){
			if(this.get("totalSize")) return this.get("totalSize");

			if(this.get("members").length == 1){
				var totalSize = this.get("members")[0].get("size");
			}
			else{
				var totalSize = _.reduce(this.get("members"), function(sum, member){
					if(typeof sum == "object")
						sum = sum.get("size");

					return sum + member.get("size");
				});
			}

			this.set("totalSize", totalSize);
			return totalSize;
		},

		/****************************/
		/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;

		    if(typeof bytes === "undefined") var bytes = this.get("size");

		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';

		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';

		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';

		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';

		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';

		    } else {
		        return bytes + ' B';
		    }
		}

	});
	return PackageModel;
});
