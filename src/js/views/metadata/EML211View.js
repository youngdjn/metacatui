define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'views/metadata/EMLGeoCoverageView',
        'views/metadata/EMLPartyView',
    		'views/metadata/EMLMethodsView',
    		'views/metadata/EMLTempCoverageView',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLGeoCoverage',
        'models/metadata/eml211/EMLKeywordSet',
        'models/metadata/eml211/EMLParty',
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText',
        'models/metadata/eml211/EMLTaxonCoverage',
        'models/metadata/eml211/EMLTemporalCoverage',
		    'models/metadata/eml211/EMLMethods',
        'text!templates/metadata/eml.html',
        'text!templates/metadata/eml-people.html',
        'text!templates/metadata/EMLPartyCopyMenu.html',
        'text!templates/metadata/metadataOverview.html',
        'text!templates/metadata/dates.html',
        'text!templates/metadata/locationsSection.html',
        'text!templates/metadata/taxonomicCoverage.html',
    		'text!templates/metadata/taxonomicClassificationTable.html',
    		'text!templates/metadata/taxonomicClassificationRow.html'],
	function(_, $, Backbone,
      ScienceMetadataView, EMLGeoCoverageView, EMLPartyView, EMLMethodsView, EMLTempCoverageView,

      EML, EMLGeoCoverage, EMLKeywordSet, EMLParty, EMLProject, EMLText, EMLTaxonCoverage,

			EMLTemporalCoverage, EMLMethods, Template, PeopleTemplate, EMLPartyCopyMenuTemplate, OverviewTemplate,
			DatesTemplate, LocationsTemplate, TaxonomicCoverageTemplate, TaxonomicClassificationTable, TaxonomicClassificationRow){

    var EMLView = ScienceMetadataView.extend({

      type: "EML211",

      el: '#metadata-container',

      events: {
        	"change .text"                 : "updateText",

        	"change .basic-text"            : "updateBasicText",
        	"keyup  .basic-text.new"        : "addBasicText",
        	"mouseover .basic-text-row .remove" : "previewTextRemove",
        	"mouseout .basic-text-row .remove"  : "previewTextRemove",

			    "change .pubDate input"          : "updatePubDate",
			    "focusout .pubDate input"        : "showPubDateValidation",

			    "keyup .eml-geocoverage.new"        : "updateLocations",

			    "change .taxonomic-coverage"             : "updateTaxonCoverage",
			    "keyup .taxonomic-coverage .new input"   : "addNewTaxon",
			    "keyup .taxonomic-coverage .new select"  : "addNewTaxon",
          "focusout .taxonomic-coverage tr"        : "showTaxonValidation",
        	"click .taxonomic-coverage-row .remove"  : "removeTaxonRank",
        	"mouseover .taxonomic-coverage .remove"  : "previewTaxonRemove",
        	"mouseout .taxonomic-coverage .remove"   : "previewTaxonRemove",

        	"change .keywords"               : "updateKeywords",
        	"keyup .keyword-row.new input"   : "addNewKeyword",
        	"mouseover .keyword-row .remove" : "previewKeywordRemove",
        	"mouseout .keyword-row .remove"  : "previewKeywordRemove",

          "change .usage"                  : "updateRadioButtons",

          "change .funding"                : "updateFunding",
        	"keyup .funding.new"             : "addFunding",
        	"mouseover .funding-row .remove" : "previewFundingRemove",
        	"mouseout .funding-row .remove"  : "previewFundingRemove",
        	"keyup .funding.error"           : "handleFundingTyping",

          "click .side-nav-item"           : "switchSection",

			    "keyup .eml-party.new"     : "handlePersonTyping",
        	"change #new-party-menu"   : "chooseNewPersonType",
        	"click .eml-party .copy"   : "showCopyPersonMenu",
        	"click #copy-party-save"   : "copyPerson",
        	"click .eml-party .remove" : "removePerson",
        	"click .eml-party .move-up" : "movePersonUp",
        	"click .eml-party .move-down" : "movePersonDown",

			    "click  .remove" : "handleRemove"
        },

        /* A list of the subviews */
        subviews: [],

        /* The active section in the view - can only be the section name (e.g. overview, people)
         * The active section is highlighted in the table of contents and is scrolled to when the page loads
         */
        activeSection: "overview",

        /* The visible section in the view - can either be the section name (e.g. overview, people) or "all"
         * The visible section is the ONLY section that is displayed. If set to all, all sections are displayed.
         */
        visibleSection: "overview",

        /* Templates */
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        datesTemplate: _.template(DatesTemplate),
        locationsTemplate: _.template(LocationsTemplate),
        taxonomicCoverageTemplate: _.template(TaxonomicCoverageTemplate),
		    taxonomicClassificationTableTemplate: _.template(TaxonomicClassificationTable),
        taxonomicClassificationRowTemplate: _.template(TaxonomicClassificationRow),
        copyPersonMenuTemplate: _.template(EMLPartyCopyMenuTemplate),
        peopleTemplate: _.template(PeopleTemplate),

        initialize: function(options) {

        	//Set up all the options
        	if(typeof options == "undefined") var options = {};

        	//The EML Model and ID
      		this.model = options.model || new EML();
      		if(!this.model.get("id") && options.id) this.model.set("id", options.id);

    		  //Get the current mode
    		  this.edit = options.edit || false;

          return this;
        },

        /* Render the view */
        render: function() {
			    MetacatUI.appModel.set('headerType', 'default');

    			//Render the basic structure of the page and table of contents
    			this.$el.html(this.template({
    				activeSection: this.activeSection,
    				visibleSection: this.visibleSection
    			}));
    			this.$container = this.$(".metadata-container");

    			//Render all the EML sections when the model is synced
    			this.renderAllSections();
    			if(!this.model.get("synced"))
    				this.listenToOnce(this.model, "sync", this.renderAllSections);

    			//Listen to updates on the data package collections
    			_.each(this.model.get("collections"), function(dataPackage){
    				if(dataPackage.type != "DataPackage") return;

    				//When the data package has been saved, render the EML again
    				this.listenTo(dataPackage, "successSaving", this.renderAllSections);
    			}, this);

          return this;
        },

        renderAllSections: function(){
        	this.renderOverview();
  	    	this.renderPeople();
  	    	this.renderDates();
  	    	this.renderLocations();
  	    	this.renderTaxa();
  	    	this.renderMethods();
  	    	this.renderProject();
  	    	this.renderSharing();

  	    	//Scroll to the active section
  	    	if(this.activeSection != "overview"){
  	    		MetacatUI.appView.scrollTo(this.$(".section." + this.activeSection));
  	    	}

			    //When scrolling through the metadata, highlight the side navigation
  	    	var view = this;
  	    	$(document).scroll(function(){
  	    		view.highlightTOC.call(view);
  	    	});

        },

        /*
         * Renders the Overview section of the page
         */
	    renderOverview: function(){
	    	//Get the overall view mode
	    	var edit = this.edit;

	    	var view = this;

	    	//Append the empty layout
	    	var overviewEl = this.$container.find(".overview");
	    	$(overviewEl).html(this.overviewTemplate());

			  //Title
		    this.renderTitle();
		    this.listenTo(this.model, "change:title", this.renderTitle);

	    	//Abstract
	    	_.each(this.model.get("abstract"), function(abs){
		    	var abstractEl = this.createEMLText(abs, edit, "abstract");

		    	//Add the abstract element to the view
		    	$(overviewEl).find(".abstract").append(abstractEl);
	    	}, this);

	    	if(!this.model.get("abstract").length){
	    		var abstractEl = this.createEMLText(null, edit, "abstract");

	    		//Add the abstract element to the view
		    	$(overviewEl).find(".abstract").append(abstractEl);
	    	}

	    	//Keywords
	    	//Iterate over each keyword and add a text input for the keyword value and a dropdown menu for the thesaurus
	    	_.each(this.model.get("keywordSets"), function(keywordSetModel){
	    		_.each(keywordSetModel.get("keywords"), function(keyword){
		    		this.addKeyword(keyword, keywordSetModel.get("thesaurus"));
	    		}, this);
	    	}, this);

	    	//Add a new keyword row
	    	this.addKeyword();

	    	//Alternate Ids
		    var altIdsEls = this.createBasicTextFields("alternateIdentifier", "Add a new alternate identifier");
		    $(overviewEl).find(".altids").append(altIdsEls);

		    //Usage
		    //Find the model value that matches a radio button and check it
			  // Note the replace() call removing newlines and replacing them with a single space
			  // character. This is a temporary hack to fix https://github.com/NCEAS/metacatui/issues/128
		    if(this.model.get("intellectualRights"))
		    	this.$(".checkbox .usage[value='" + this.model.get("intellectualRights").replace(/\r?\n|\r/g, ' ') + "']").prop("checked", true);

		    //Funding
		    this.renderFunding();

  			// pubDate
  			// BDM: This isn't a createBasicText call because that helper
  			// assumes multiple values for the category
  			// TODO: Consider a re-factor of createBasicText
  			var pubDateInput = $(overviewEl).find("input.pubDate").val(this.model.get("pubDate"));

  			//Initialize all the tooltips
  			this.$(".tooltip-this").tooltip();

	    },

	    renderTitle: function(){
	    	var titleEl = this.createBasicTextFields("title", "Example: Greater Yellowstone Rivers from 1:126,700 U.S. Forest Service Visitor Maps (1961-1983)", false);
	    	this.$container.find(".overview").find(".title-container").html(titleEl);
	    },

	    /*
       * Renders the People section of the page
       */
	    renderPeople: function(){
	    	this.$(".section.people").empty().append("<h2>People</h2>");

	    	var PIs      = _.filter(this.model.get("associatedParty"), function(party){ return party.get("roles").includes("principalInvestigator") }),
	    		coPIs      = _.filter(this.model.get("associatedParty"), function(party){ return party.get("roles").includes("coPrincipalInvestigator") }),
	    		collbalPIs = _.filter(this.model.get("associatedParty"), function(party){ return party.get("roles").includes("collaboratingPrincipalInvestigator") }),
	    		custodian  = _.filter(this.model.get("associatedParty"), function(party){ return party.get("roles").includes("custodianSteward") }),
	    		user       = _.filter(this.model.get("associatedParty"), function(party){ return party.get("roles").includes("user") });

	    	var emptyTypes = [];

	    	this.partyTypeMap = {
	    			"collaboratingPrincipalInvestigator" : "Collaborating-Principal Investigators",
	    			"coPrincipalInvestigator" : "Co-Principal Investigators",
	    			"principalInvestigator" : "Principal Investigators",
	    			"creator" : "Dataset Creators (Authors/Owners/Originators)",
	    			"contact" : "Contacts",
	    			"metadataProvider" : "Metadata Provider",
	    			"custodianSteward" : "Custodians/Stewards",
	    			"publisher" : "Publisher",
	    			"user" : "Users"
	    	}

        //Insert the people template
        this.$(".section[data-section='people']").html(this.peopleTemplate());

        if( this.model.get("creator").length ){
  	    	//Creators
  	    	_.each(this.model.get("creator"), function(creator){
            this.renderPerson(creator, "creator")
          }, this);
  	    	this.renderPerson(null, "creator");
        }
        else{
          var creator = new EMLParty({ type: "creator", parentModel: this.model });
          this.model.get("creator").push(creator);
          creator.createFromUser();
          this.renderPerson(creator);
          this.renderPerson(null, "creator");
        }

        if( this.model.get("contact").length ){
  	    	//Contacts
          _.each(this.model.get("contact"), function(contact){
            this.renderPerson(contact, "contact")
          }, this);
  	    	this.renderPerson(null, "contact");
        }
        else{
          var contact = new EMLParty({ type: "contact", parentModel: this.model });
          this.model.get("contact").push(contact);
          contact.createFromUser();
          this.renderPerson(contact);
          this.renderPerson(null, "contact");
        }

	    	//Principal Investigators
	    	if(PIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["principalInvestigator"] + "<i class='required-icon hidden' data-category='principalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="principalInvestigator"></div>');

          _.each(PIs, function(PI){
            this.renderPerson(PI, "principalInvestigator")
          }, this);

	    		this.renderPerson(null, "principalInvestigator");
	    	}
	    	else{
	    		emptyTypes.push("principalInvestigator");
	    	}

	    	//Co-PIs
	    	if(coPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["coPrincipalInvestigator"] + "<i class='required-icon hidden' data-category='coPrincipalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="coPrincipalInvestigator"></div>');
          _.each(coPIs, function(coPI){
            this.renderPerson(coPI, "coPrincipalInvestigator")
          }, this);

	    		this.renderPerson(null, "coPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("coPrincipalInvestigator");

	    	//Collab PIs
	    	if(collbalPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["collaboratingPrincipalInvestigator"] + "<i class='required-icon hidden' data-category='collaboratingPrincipalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="collaboratingPrincipalInvestigator"></div>');
          _.each(collbalPIs, function(collbalPI){
            this.renderPerson(collbalPI, "collaboratingPrincipalInvestigator")
          }, this);

	    		this.renderPerson(null, "collaboratingPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("collaboratingPrincipalInvestigator");

	    	//Metadata Provider
	    	if(this.model.get("metadataProvider").length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["metadataProvider"] + "<i class='required-icon hidden' data-category='metadataProvider'></i></h4>",
		    			'<div class="row-striped" data-attribute="metadataProvider"></div>');
          _.each(this.model.get("metadataProvider"), function(provider){
            this.renderPerson(provider, "metadataProvider")
          }, this);

		    	this.renderPerson(null, "metadataProvider");
	    	}
	    	else
	    		emptyTypes.push("metadataProvider");

	    	//Custodian/Steward
	    	if(custodian.length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["custodianSteward"] + "<i class='required-icon hidden' data-category='custodianSteward'></i></h4>",
	    			'<div class="row-striped" data-attribute="custodianSteward"></div>');

          _.each(custodian, function(custodianInd){
            this.renderPerson(custodianInd, "custodianSteward")
          }, this);

	    		this.renderPerson(null, "custodianSteward");
	    	}
	    	else
	    		emptyTypes.push("custodianSteward");

	    	//Publisher
	    	if(this.model.get("publisher").length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["publisher"] + "<i class='required-icon hidden' data-category='publisher'></i></h4>",
	    			'<p class="subtle">Only one publisher can be specified.</p>',
	    			'<div class="row-striped" data-attribute="publisher"></div>');

          _.each(this.model.get("publisher"), function(publisher){
            this.renderPerson(publisher, "publisher")
          }, this);
	    	}
	    	else
	    		emptyTypes.push("publisher");

	    	//User
	    	if(user.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["user"] + "<i class='required-icon hidden' data-category='user'></i></h4>",
		    			'<div class="row-striped" data-attribute="user"></div>');

          _.each(user, function(userInd){
            this.renderPerson(userInd, "user")
          }, this);

		    	this.renderPerson(null, "user");
	    	}
	    	else
	    		emptyTypes.push("user");

	    	//Display a drop-down menu for all the empty party types
	    	if(emptyTypes.length){

          //Create a dropdown menu for adding new person types
		    	var menu = $(document.createElement("select")).attr("id", "new-party-menu").addClass("header-dropdown");

          //Add the first option to the menu, which works as a label
          menu.append( $(document.createElement("option")).text("Choose new person or organization role ...") );

          //Add some help text for the menu
          var helpText = "Optionally add other contributors, collaborators, and maintainers of this dataset.";
          menu.attr("title", helpText);

          //Add a container element for the new party
		    	var newPartyContainer = $(document.createElement("div"))
		    							.attr("data-attribute", "new")
		    							.addClass("row-striped");

          //For each party type that is empty, add it to the menu as an option
		    	_.each(emptyTypes, function(type){

		    		$(menu).append( $(document.createElement("option"))
                            .val(type)
                            .text(this.partyTypeMap[type]) );

		    	}, this);

          //Add the menu and new party element to the page
		    	this.$(".section.people").append(menu, newPartyContainer);

          //Render a new blank party form
		    	this.renderPerson(null, "new");
	    	}

	    	// When the EML model has been saved, re-render the people section.
	    	// This is needed because the EML model will automatically create a creator and contact
	    	//   if none is supplied by the user. This will render them when they are added.
	    	var view = this;
	    	this.listenTo(this.model, "successSaving", function(){
	    		this.renderPeople();
	    	});

    		//Initialize the tooltips
    		this.$("input.tooltip-this").tooltip({
    			placement: "top",
    			title: function(){
    				return $(this).attr("data-title") || $(this).attr("placeholder")
    			},
    			delay: 1000
    		});

	    },

	    renderPerson: function(emlParty, partyType){

	    	//If no model is given, create a new model
	    	if(!emlParty){
	    		var emlParty = new EMLParty({
	    			parentModel: this.model
	    		});

	    		//Mark this model as new
	    		var isNew = true;

	    		//Find the party type or role based on the type given
          if(partyType){
            if( _.includes(emlParty.get("roleOptions"), partyType) ){
              emlParty.get("roles").push(partyType);
            } else if ( _.includes(emlParty.get("typeOptions"), partyType) ){
              emlParty.set("type", partyType);
            }
          }

	    	}
	    	else{
	    		var isNew = false;

		    	//Get the party type, if it was not sent as a parameter
		    	if(!partyType || !partyType.length ){
            var partyType = emlParty.get("type") || emlParty.get("roles");
          }

	    	}

        // partyType is a string when if it's a 'type' and an array if it's 'roles'
        // If it's a string, convert to an array for the subsequent _.each() function
        if(typeof partyType == "string"){
          partyType = [partyType]
        }

        _.each(partyType, function(partyType){

  	    	//Find the container section for this party type
  	    	var container = this.$(".section.people").find('[data-attribute="' + partyType + '"]');

  	    	//See if this view already exists
  	    	if( !isNew && container.length && emlParty ){
  	    		var partyView;

  	    		_.each(container.find(".eml-party"), function(singlePartyEl){

  	    			//If this EMLPartyView element is for the current model, then get the View
  	    			if( $(singlePartyEl).data("model") == emlParty )
  	    				partyView = $(singlePartyEl).data("view");
  	    		});

  	    		//If a partyView was found, just rerender it and exit
  	    		if(partyView){
  	    			partyView.render();
  	    			return;
  	    		}
  	    	}

  	    	//If there still is no partyView found, create a new one
  	    	var partyView = new EMLPartyView({
      			model: emlParty,
      			edit: this.edit,
      			isNew: isNew
  	    	});

  	    	//If this person type is not on the page yet, add it
          // For now, this only adds the first role if person has multiple roles
  	    	if(!container.length){
  	    		this.addNewPersonType(emlParty.get("type") || emlParty.get("roles")[0]);
  	    		container = this.$(".section.people").find('[data-attribute="' + partyType + '"]');
  	    	}

  	    	if(isNew){
            container.append(partyView.render().el);
          }else{
  	    		if(container.find(".new").length)
  	    			container.find(".new").before(partyView.render().el);
  	    		else
  	    			container.append(partyView.render().el);
  	    	}

        }, this);


	    },

	    /*
	     * This function reacts to the user typing a new person in the person section (an EMLPartyView)
	     */
	    handlePersonTyping: function(e){
	    	var container = $(e.target).parents(".eml-party"),
    			emlParty  = container.length? container.data("model") : null,
    			partyType = container.length && emlParty ? emlParty.get("roles")[0] || emlParty.get("type") : null;

    		if(this.$("[data-attribute='" + partyType + "'] .eml-party.new").length > 1) return;

			//Render a new person
			if(partyType != "publisher")
				this.renderPerson(null, partyType);
	    },

	    /*
	     * This function is called when someone chooses a new person type from the dropdown list
	     */
	    chooseNewPersonType: function(e){
	    	var partyType = $(e.target).val();

	    	if(!partyType) return;

	    	//Get the form and model
	    	var partyForm  = this.$(".section.people").find('[data-attribute="new"]'),
	    		partyModel = partyForm.find(".eml-party").data("model");

	    	//Set the type on this person form
	    	partyForm.attr("data-attribute", partyType);

	    	//Get the party type dropdown menu
	    	var partyMenu = this.$("#new-party-menu");

	    	//Add a new header
	    	partyMenu.before("<h4>" + this.partyTypeMap[partyType] + "</h4>");

	    	if(partyType == "publisher")
	    		partyMenu.before('<p class="subtle">Only one publisher can be specified.</p>');

	    	//Remove this type from the dropdown menu
	    	partyMenu.find("[value='" + partyType + "']").remove();

	    	//Remove the menu from the page temporarily
	    	partyMenu.detach();

	    	//Add the new party type form
	    	var newPartyContainer = $(document.createElement("div"))
									.attr("data-attribute", "new")
									.addClass("row-striped");
	    	this.$(".section.people").append(newPartyContainer);
	    	this.renderPerson(null, "new");
	    	$(newPartyContainer).before(partyMenu);

	    	//Update the model
        if( _.includes(partyModel.get("roleOptions"), partyType) ){
          partyModel.get("roles").push(partyType);
        } else {
          partyModel.set("type", partyType);
        }

	    	if(partyModel.isValid()){
	    		partyModel.mergeIntoParent();

	    		//Add a new person of that type
	    		this.renderPerson(null, partyType);
	    	}
	    	else{
	    		partyForm.find(".eml-party").data("view").showValidation();
	    	}
	    },

	    /*
	     * addNewPersonType - Adds a header and container to the People section for the given party type/role,
	     */
	    addNewPersonType: function(partyType){
	    	if(!partyType) return;

			// Container element to hold all parties of this type
			var partyTypeContainer = $(document.createElement("div")).addClass("party-type-container");

	    	// Add a new header for the party type
	    	var header = $(document.createElement("h4")).text(this.partyTypeMap[partyType]);
			$(partyTypeContainer).append(header);

	    	//Remove this type from the dropdown menu
	    	this.$("#new-party-menu").find("[value='" + partyType + "']").remove();

	    	//Add the new party container
	    	var partyRow = $(document.createElement("div"))
									.attr("data-attribute", partyType)
									.addClass("row-striped");
	    	partyTypeContainer.append(partyRow);

			// Add in the new party type container just before the dropdown
			this.$("#new-party-menu").before(partyTypeContainer);

	    	//Add a blank form to the new person type section
	    	this.renderPerson(null, partyType);
	    },

	    /*
	     * showCopyPersonMenu: Displays a modal window to the user with a list of roles that they can
	     * copy this person to
	     */
	    showCopyPersonMenu: function(e){

	    	//Get the EMLParty to copy
	    	var partyToCopy = $(e.target).parents(".eml-party").data("model"),
	    		menu = this.$("#copy-person-menu");

	    	//Check if the modal window menu has been created already
	    	if( !menu.length ){

	    		//Create the modal window menu from the template
	    		menu = $(this.copyPersonMenuTemplate());

	    		//Add to the DOM
		    	this.$el.append(menu);

		    	//Initialize the modal
		    	menu.modal();
	    	}
	    	else{
	    		//Reset all the checkboxes
	    		menu.find("input:checked").prop("checked", false);
	    		menu.find(".disabled")
	    			.prop("disabled", false)
	    			.removeClass("disabled")
	    			.parent(".checkbox")
	    			.attr("title", "");
	    	}

	    	//Disable the roles this person is already in
	    	var currentRoles = partyToCopy.get("roles") || partyToCopy.get("type") || "";
        // "type" is a string and "roles" is an array.
        // so that we can use _.each() on both, convert "type" to an array
        if(typeof currentRoles == "string"){
          currentRoles = [currentRoles];
        }
        _.each(currentRoles, function(currentRole){
          menu.find("input[value='" + currentRole + "']")
  	    		.prop("disabled", "disabled")
  	    		.addClass("disabled")
  	    		.parent(".checkbox")
  	    		.attr("title", "This person is already in the " + this.partyTypeMap[currentRole] + " list.");

        }, this);

	    	//If there is already one publisher, disable that option
	    	if( this.model.get("publisher").length ){
	    		var publisherName = this.model.get("publisher")[0].get("individualName") ?
	    							this.model.get("publisher")[0].get("individualName").givenName + " " +
	    							this.model.get("publisher")[0].get("individualName").surName :
	    							this.model.get("publisher")[0].get("organizationName") ||
	    							this.model.get("publisher")[0].get("positionName") ||
	    							"Someone";

	    		menu.find("input[value='publisher']")
		    		.prop("disabled", "disabled")
		    		.addClass("disabled")
		    		.parent(".checkbox")
		    		.attr("title", publisherName + " is already listed as the publisher. (There can be only one).");

	    	}

	    	//Attach the EMLParty to the menu DOMs
	    	menu.data({
	    		EMLParty: partyToCopy
	    	});

	    	//Show the modal window menu now
	    	menu.modal("show");
	    },

	    /*
	     * copyPerson: Gets the selected checkboxes from the copy person menu and copies the EMLParty
	     * to those new roles
	     */
	    copyPerson: function(){

	    	//Get all the checked boxes
	    	var checkedBoxes = this.$("#copy-person-menu input:checked"),
	    	//Get the EMLParty to copy
	    		partyToCopy  = this.$("#copy-person-menu").data("EMLParty");

	    	//For each selected role,
	    	_.each(checkedBoxes, function(checkedBox){

	    		//Get the roles
	    		var role = $(checkedBox).val(),
	    			isAssocParty = _.contains(partyToCopy.get("roleOptions"), role);

	    		//If the new role is an associated party ...
	    		if( isAssocParty ){

		    		//If there are no parties in this role yet,
	    			// then add this person type to the view
	    			if( !this.model.get("associatedParty").length )
	    				this.addNewPersonType(role);
	    			else if( !_.find(this.model.get("associatedParty"), function(p){
	    				return  p.get("role") == role;
	    			}) ){
	    				this.addNewPersonType(role);
	    			}

	    			//Create a new EMLParty model
    				var newPerson = new EMLParty();

	    			//Create all the attributes for the new person. We're only changing the role
	    			newPerson.set( partyToCopy.copyValues() );
	    			newPerson.set("type", "associatedParty");
	    			newPerson.set("roles", [role]);

            //Add this new EMLParty to the EML model
            this.model.addParty(newPerson);

	    			//Render this new person
		    		this.renderPerson(newPerson, role);
	    		}
	    		//If the new role is not an associated party...
	    		else{
		    		//If there are no parties in this role yet,
	    			// then add this person type to the view
	    			if( !this.model.get(role).length )
		    			this.addNewPersonType(role);

	    			//Create a new EMLParty model
    				var newPerson = new EMLParty();

    				// Copy the attributes from the original person
    				// and set it on the new person
    				newPerson.set(partyToCopy.copyValues());
    				newPerson.set("type", role);
    				newPerson.set("roles", newPerson.defaults().role);

            //Add this new EMLParty to the EML model
            this.model.addParty(newPerson);

	    			//Render this new person
		    		this.renderPerson(newPerson, role);
	    		}

	    	}, this);

	    	//If there was at least one copy created, then trigger the change event
	    	if(checkedBoxes.length){
	    		this.model.trickleUpChange();
	    	}
	    },

	    removePerson: function(e){
	    	e.preventDefault();

	    	//Get the party view el, view, and model
	    	var partyEl = $(e.target).parents(".eml-party"),
	    		partyView = partyEl.data("view"),
	    		partyToRemove = partyEl.data("model");

	    	//If there is no model found, we have nothing to do, so exit
	    	if(!partyToRemove) return false;

	    	//Call removeParty on the EML211 model to remove this EMLParty
	    	this.model.removeParty(partyToRemove);

	    	//Let the EMLPartyView remove itself
	    	partyView.remove();

			},

			movePersonUp: function(e){
	    	e.preventDefault();

				// TODO

			},

      /**
       * Attempt to move the current person (Party) one index forward (down).
       *
       * @param {EventHandler} e: The click event handle
       */
	    movePersonDown: function(e){
				e.preventDefault();

	    	// Get the party view el, view, and model
	    	var partyEl = $(e.target).parents(".eml-party"),
            model = partyEl.data("model"),
            next = $(partyEl).next().not(".new");

        if (next.length === 0) {
          console.log("Not moving down because we're last.");

          return;
        }

				// Remove current view, create and insert a new one for the model
        $(partyEl).remove();

        var newView = new EMLPartyView({
          model: model,
          edit: this.edit
        });

        $(next).after(newView.render().el);

        // Move the party down within the model too
	    	this.model.movePartyDown(model);
	    },


	    /*
         * Renders the Dates section of the page
         */
	    renderDates: function(){

	    	//Add a header
	    	this.$(".section.dates").html( $(document.createElement("h2")).text("Dates") );

            _.each(this.model.get('temporalCoverage'), function(model){

            	var tempCovView = new EMLTempCoverageView({
            		model: model,
            		isNew: false,
            		edit: this.edit
            	});

            	tempCovView.render();

    	    	this.$(".section.dates").append(tempCovView.el);

            }, this);

            if( !this.model.get('temporalCoverage').length ){
            	var tempCovView = new EMLTempCoverageView({
            		isNew: true,
            		edit: this.edit,
            		model: new EMLTemporalCoverage({ parentModel: this.model })
            	});

            	tempCovView.render();

    	    	this.$(".section.dates").append(tempCovView.el);
            }

	    },

	    /*
         * Renders the Locations section of the page
         */
	    renderLocations: function(){
	    	var locationsSection = this.$(".section.locations");

	    	//Add the Locations header
	    	locationsSection.html(this.locationsTemplate());
	    	var locationsTable = locationsSection.find(".locations-table");

	    	//Render an EMLGeoCoverage view for each EMLGeoCoverage model
	    	_.each(this.model.get("geoCoverage"), function(geo, i){
	    		//Create an EMLGeoCoverageView
	    		var geoView = new EMLGeoCoverageView({
	    			model: geo,
	    			edit: this.edit
	    			});

	    		//Render the view
	    		geoView.render();

	    		geoView.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));

	    		//Add the locations section to the page
	    		locationsTable.append(geoView.el);

	    		//Listen to validation events
	    		this.listenTo(geo, "valid", this.updateLocationsError);

	    		//Save it in our subviews array
	    		this.subviews.push(geoView);
	    	}, this);

	    	//Now add one empty row to enter a new geo coverage
	    	if(this.edit){
	    		var newGeoModel = new EMLGeoCoverage({ parentModel: this.model, isNew: true}),
	    			newGeoView = new EMLGeoCoverageView({
		    			edit: true,
		    			model: newGeoModel,
		    			isNew: true
	    			});
	    		locationsTable.append(newGeoView.render().el);
	    		newGeoView.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));

	    		//Listen to validation events
	    		this.listenTo(newGeoModel, "valid", this.updateLocationsError);
	    	}
	    },

	    /*
         * Renders the Taxa section of the page
         */
	    renderTaxa: function(){
	    	this.$(".section.taxa").html($(document.createElement("h2")).text("Taxa"));

			var taxonomy = this.model.get('taxonCoverage');

			// Render a set of tables for each taxonomicCoverage
			if (typeof taxonomy !== "undefined" && (Array.isArray(taxonomy) && taxonomy.length)) {
				for (var i = 0; i < taxonomy.length; i++) {
					this.$(".section.taxa").append(this.createTaxonomicCoverage(taxonomy[i]));
				}
			} else {
				// Create a new one
				var taxonCov = new EMLTaxonCoverage({
					parentModel: this.model
				});

				this.model.set('taxonCoverage', [taxonCov], {silent: true});

				this.$(".section.taxa").append(this.createTaxonomicCoverage(taxonCov));
			}

            // updating the indexes of taxa-tables before rendering the information on page(view).
            var taxaNums = this.$(".editor-header-index");
            for (var i = 0; i < taxaNums.length; i++) {
                $(taxaNums[i]).text(i + 1);
            }
	    },

	    /*
       * Renders the Methods section of the page
       */
	    renderMethods: function(){
	    	var methodsModel = this.model.get("methods");

  			if (!methodsModel) {
  				methodsModel = new EMLMethods({ edit: this.edit, parentModel: this.model });
  			}

			  this.$(".section.methods").html(new EMLMethodsView({
				      model: methodsModel,
				      edit: this.edit }).render().el);
		  },

	    /*
         * Renders the Projcet section of the page
         */
	    renderProject: function(){

	    },

	    /*
         * Renders the Sharing section of the page
         */
	    renderSharing: function(){

	    },

	    /*
	     * Renders the funding field of the EML
	     */
	    renderFunding: function(){
	    	//Funding
		    var funding = this.model.get("project") ? this.model.get("project").get("funding") : [];

		    //Clear the funding section
		    $(".section.overview .funding").empty();

		    //Create the funding input elements
		    _.each(funding, function(fundingItem, i){

		    	this.addFunding(fundingItem);

		    }, this);

		    //Add a blank funding input
		    this.addFunding();
	    },

	    /*
	     * Adds a single funding input row. Can either be called directly or used as an event callback
	     */
	    addFunding: function(argument){
	    	if(this.edit){

	    		if(typeof argument == "string")
	    			var value = argument;
	    		else if(!argument)
	    			var value = "";
	    		//Don't add another new funding input if there already is one
	    		else if( !value && (typeof argument == "object") && !$(argument.target).is(".new") )
	    			return;
	    		else if((typeof argument == "object") && argument.target) {
					var event = argument;

					// Don't add a new funding row if the current one is empty
					if ( $(event.target).val().trim() === "") return;
				}

		    	var fundingInput       = $(document.createElement("input"))
		    								.attr("type", "text")
		    								.attr("data-category", "funding")
		    								.addClass("span12 funding hover-autocomplete-target")
		    								.attr("placeholder", "Search for NSF awards by keyword or enter custom funding information")
		    								.val(value),
			    	hiddenFundingInput = fundingInput.clone().attr("type", "hidden").val(value).attr("id", "").addClass("hidden"),
			    	loadingSpinner     = $(document.createElement("i")).addClass("icon icon-spinner input-icon icon-spin subtle hidden");

		    	//Append all the elements to a container
		    	var containerEl = $(document.createElement("div"))
		    						.addClass("ui-autocomplete-container funding-row")
		    						.append(fundingInput,
									  loadingSpinner,
									  hiddenFundingInput);

				if (!value){
					$(fundingInput).addClass("new");

					if(event) {
						$(event.target).parents("div.funding-row").append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));
						$(event.target).removeClass("new");
					}
				} else { // Add a remove button if this is a non-new funding element
					$(containerEl).append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));
				}

		    	var view = this;

			    //Setup the autocomplete widget for the funding input
			    fundingInput.autocomplete({
					source: function(request, response){
						var beforeRequest = function(){
							loadingSpinner.show();
						}

						var afterRequest = function(){
							loadingSpinner.hide();
						}

						return MetacatUI.appLookupModel.getGrantAutocomplete(request, response, beforeRequest, afterRequest)
					},
					select: function(e, ui) {
						e.preventDefault();

						var value = "NSF Award " + ui.item.value + " (" + ui.item.label + ")";
						hiddenFundingInput.val(value);
						fundingInput.val(value);

						$(".funding .ui-helper-hidden-accessible").hide();
						loadingSpinner.css("top", "5px");

						view.updateFunding(e);

					},
					position: {
						my: "left top",
						at: "left bottom",
						of: fundingInput,
						collision: "fit"
					},
					appendTo: containerEl,
					minLength: 3
				});

			    this.$(".funding-container").append(containerEl);
	    	}
	    },

	    previewFundingRemove: function(e){
	    	$(e.target).parents(".funding-row").toggleClass("remove-preview");
	    },

	    handleFundingTyping: function(e){
	    	var fundingInput = $(e.target);

	    	//If the funding value is at least one character
	    	if(fundingInput.val().length > 0){
	    		//Get rid of the error styling in this row
	    		fundingInput.parent(".funding-row").children().removeClass("error");

	    		//If this was the only funding input with an error, we can safely remove the error message
	    		if( !this.$("input.funding.error").length )
	    			this.$("[data-category='funding'] .notification").removeClass("error").text("");
	    	}
	    },

	    addKeyword: function(keyword, thesaurus){
	    	if(typeof keyword != "string" || !keyword){
	    		var keyword = "";

	    		//Only show one new keyword row at a time
	    		if((this.$(".keyword.new").length == 1) && !this.$(".keyword.new").val())
	    			return;
	    		else if(this.$(".keyword.new").length > 1)
	    			return;
	    	}

	    	//Create the keyword row HTML
	    	var	row          = $(document.createElement("div")).addClass("row-fluid keyword-row"),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10").attr("placeholder", "Add one new keyword"),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2"),
          thesOptionExists = false,
				  removeButton;

        // Piece together the inputs
        row.append(keywordInput, thesInput);

        //Create the thesaurus options dropdown menu
        _.each(MetacatUI.appModel.get("emlKeywordThesauri"), function(option){

          var optionEl = $(document.createElement("option")).val(option.thesaurus).text(option.label);
          thesInput.append( optionEl );

          if( option.thesaurus == thesaurus ){
            optionEl.prop("selected", true);
            thesOptionExists = true;
          }
        });

        //Add a "None" option, which is always in the dropdown
        thesInput.prepend( $(document.createElement("option")).val("None").text("None") );

        if( thesaurus == "None" || !thesaurus ){
          thesInput.val("None");
        }
        //If this keyword is from a custom thesaurus that is NOT configured in this App, AND
        // there is an option with the same label, then remove the option so it doesn't look like a duplicate.
        else if( !thesOptionExists && _.findWhere(MetacatUI.appModel.get("emlKeywordThesauri"), { label: thesaurus }) ){
          var duplicateOptions = thesInput.find("option:contains(" + thesaurus + ")");
          duplicateOptions.each(function(i, option){
            if( $(option).text() == thesaurus && !$(option).prop("selected") ){
              $(option).remove();
            }
          });
        }
        //If this keyword is from a custom thesaurus that is NOT configured in this App, then show it as a custom option
        else if( !thesOptionExists ){
          thesInput.append( $(document.createElement("option")).val(thesaurus).text(thesaurus).prop("selected", true) );
        }

	    	if(!keyword)
				row.addClass("new");
	    	else{

    			//Set the keyword value on the text input
    			keywordInput.val(keyword);

    			// Add a remove button unless this is the .new keyword
				row.append(this.createRemoveButton(null, 'keywordSets', 'div.keyword-row', 'div.keywords'));
	    	}

	    	this.$(".keywords").append(row);
	    },

		addNewKeyword: function(e) {
			if ($(e.target).val().trim() === "") return;

			$(e.target).parents(".keyword-row").first().removeClass("new");

			// Add in a remove button
			$(e.target).parents(".keyword-row").append(this.createRemoveButton(null, 'keywordSets', 'div.keyword-row', 'div.keywords'));

			var row          = $(document.createElement("div")).addClass("row-fluid keyword-row new").data({ model: new EMLKeywordSet() }),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10"),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2");

			row.append(keywordInput, thesInput);

      //Create the thesaurus options dropdown menu
      _.each(MetacatUI.appModel.get("emlKeywordThesauri"), function(option){
        thesInput.append( $(document.createElement("option")).val(option.thesaurus).text(option.label) );
      });

      //Add a "None" option, which is always in the dropdown
      thesInput.prepend( $(document.createElement("option")).val("None").text("None").prop("selected", true) );

			this.$(".keywords").append(row);
		},

		previewKeywordRemove: function(e){
			var row = $(e.target).parents(".keyword-row").toggleClass("remove-preview");
		},

	    /*
	     * Update the funding info when the form is changed
	     */
	    updateFunding: function(e){
	    	if(!e) return;

	    	var row      = $(e.target).parent(".funding-row").first(),
  	    		rowNum   = this.$(".funding-row").index(row),
  	    		input    = $(row).find("input"),
            isNew    = $(row).is(".new");

        var newValue = isNew? $(e.target).siblings("input.hidden").val() : $(e.target).val();

        newValue = this.model.cleanXMLText(newValue);

        if( typeof newValue == "string" ){
          newValue = newValue.trim();
        }

	    	//If there is no project model
	    	if(!this.model.get("project")){
	    		var model = new EMLProject({ parentModel: this.model });
	    		this.model.set("project", model);
	    	}
	    	else
	    		var model = this.model.get("project");

	    	var currentFundingValues = model.get("funding");

        //If the new value is an empty string, then remove that index in the array
        if( typeof newValue == "string" && newValue.trim().length == 0 ){
          currentFundingValues = currentFundingValues.splice(rowNum, 1);
        }
        else{
	    	  currentFundingValues[rowNum] = newValue;
        }

	    	if(isNew && newValue != ''){
	    		$(row).removeClass("new");

  				// Add in a remove button
  				$(e.target).parent().append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));

	    		this.addFunding();
	    	}

	    	this.model.trickleUpChange();

	    },

	    //TODO: Comma and semi-colon seperate keywords
	    updateKeywords: function(e){

	    	var keywordSets = this.model.get("keywordSets"),
	    		newKeywordSets = [];

	    	//Get all the keywords in the view
	    	_.each(this.$(".keyword-row"), function(thisRow){
	    		var thesaurus = this.model.cleanXMLText( $(thisRow).find("select").val() ),
	    			keyword     = this.model.cleanXMLText( $(thisRow).find("input").val() );

	    		if(!keyword) return;

	    		var keywordSet = _.find(newKeywordSets, function(keywordSet){
		    		return keywordSet.get("thesaurus") == thesaurus;
		    	});

	    		if(typeof keywordSet != "undefined"){
		    		keywordSet.get("keywords").push(keyword);
		    	}
		    	else{
		    		newKeywordSets.push(new EMLKeywordSet({
			    			parentModel: this.model,
			    			keywords: [keyword],
			    			thesaurus: thesaurus
		    			}));
		    	}

	    	}, this);

	    	//Update the EML model
	    	this.model.set("keywordSets", newKeywordSets);

	    	if(e){
		    	var row = $(e.target).parent(".keyword-row");

		    	//Add a new row when the user has added a new keyword just now
		    	if(row.is(".new")){
		    		row.removeClass("new");
					row.append(this.createRemoveButton(null, "keywordSets", "div.keyword-row", "div.keywords"));
		    		this.addKeyword();
		    	}
	    	}
	    },

	    /*
	     * Update the EML Geo Coverage models and views when the user interacts with the locations section
	     */
	    updateLocations: function(e){
	    	if(!e) return;

	    	e.preventDefault();

	    	var viewEl = $(e.target).parents(".eml-geocoverage"),
	    		geoCovModel = viewEl.data("model");

	    	//If the EMLGeoCoverage is new
	    	if(viewEl.is(".new")){

	    		if(this.$(".eml-geocoverage.new").length > 1)
	    			return;

	    		//Render the new geo coverage view
	    		var newGeo = new EMLGeoCoverageView({
	    			edit: this.edit,
	    			model: new EMLGeoCoverage({ parentModel: this.model, isNew: true}),
	    			isNew: true
	    		});
	    		this.$(".locations-table").append(newGeo.render().el);
	    		newGeo.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));

	    		//Unmark the view as new
	    		viewEl.data("view").notNew();

	    		//Get the EMLGeoCoverage model attached to this EMlGeoCoverageView
	    		var geoModel = viewEl.data("model"),
	    		//Get the current EMLGeoCoverage models set on the parent EML model
	    			currentCoverages = this.model.get("geoCoverage");

	    		//Add this new geo coverage model to the parent EML model
	    		if(Array.isArray(currentCoverages)){
	    			if( !_.contains(currentCoverages, geoModel) ){
	    				currentCoverages.push(geoModel);
	    				this.model.trigger("change:geoCoverage");
	    			}
	    		}
	    		else{
	    			currentCoverages = [currentCoverages, geoModel];
	    			this.model.set("geoCoverage", currentCoverages);
	    		}
	    	}
	    },

	    /*
	     * If all the EMLGeoCoverage models are valid, remove the error messages for the Locations section
	     */
	    updateLocationsError: function(){
	    	var allValid = _.every(this.model.get("geoCoverage"), function(geoCoverageModel){

	    						return geoCoverageModel.isValid();

	    					});

	    	if(allValid){
	    		this.$(".side-nav-item.error[data-category='geoCoverage']")
	    			.removeClass("error")
	    			.find(".icon.error").hide();
	    		this.$(".section[data-section='locations'] .notification.error")
	    			.removeClass("error")
	    			.text("");
	    	}

	    },

	    /*
         * Creates the text elements
         */
	    createEMLText: function(textModel, edit, category){

	    	if(!textModel && edit){
	    		return $(document.createElement("textarea"))
	    				.attr("data-category", category)
	    				.addClass("xlarge text");
	    	}
	    	else if(!textModel && !edit){
	    		return $(document.createElement("div"))
						.attr("data-category", category);
	    	}

	    	//Get the EMLText from the EML model
	    	var finishedEl;

	    	//Get the text attribute from the EMLText model
	    	var	paragraphs = textModel.get("text"),
	    		paragraphsString = "";

	    	//If the text should be editable,
	    	if(edit){
		    	//Format the paragraphs with carriage returns between paragraphs
				paragraphsString = paragraphs.join(String.fromCharCode(13));

		    	//Create the textarea element
		    	finishedEl = $(document.createElement("textarea"))
	    						 .addClass("xlarge text")
	    						 .attr("data-category", category)
	    						 .html(paragraphsString);
	    	}
	    	else{
	    		//Format the paragraphs with HTML
		    	_.each(paragraphs, function(p){
		    		paragraphsString += "<p>" + p + "</p>";
		    	});

		    	//Create a div
		    	finishedEl = $(document.createElement("div"))
		    				.attr("data-category", category)
		    				.append(paragraphsString);
	    	}

		    $(finishedEl).data({ model: textModel });

	    	//Return the finished DOM element
	    	return finishedEl;
	    },

	    /*
	     * Updates a basic text field in the EML after the user changes the value
	     */
	    updateText: function(e){
	    	if(!e) return false;

	    	var category  = $(e.target).attr("data-category"),
	    		currentValue = this.model.get(category),
	    		textModel = $(e.target).data("model"),
	    		value     = this.model.cleanXMLText($(e.target).val());

	    	//We can't update anything without a category
	    	if(!category) return false;

	    	//Get the list of paragraphs - checking for carriage returns and line feeds
	    	var paragraphsCR = value.split(String.fromCharCode(13));
	    	var paragraphsLF = value.split(String.fromCharCode(10));

	    	//Use the paragraph list that has the most
	    	var paragraphs = (paragraphsCR > paragraphsLF)? paragraphsCR : paragraphsLF;

	    	//If this category isn't set yet, then create a new EMLText model
	    	if(!textModel){

	    		//Get the current value for this category and create a new EMLText model
	    		var newTextModel = new EMLText({ text: paragraphs, parentModel: this.model });

	    		// Save the new model onto the underlying DOM node
	    		$(e.target).data({ "model" : newTextModel });

	    		//Set the new EMLText model on the EML model
	    		if(Array.isArray(currentValue)){
	    			currentValue.push(newTextModel);
	    			this.model.trigger("change:" + category);
	    			this.model.trigger("change");
	    		}
	    		else{
	    			this.model.set(category, newTextModel);
	    		}

	    	}
	    	//Update the existing EMLText model
	    	else{

	    		//If there are no paragraphs or all the paragraphs are empty...
	    		if( !paragraphs.length || _.every(paragraphs, function(p){ return p.trim() == "" }) ){

	    			//Remove this text model from the array of text models since it is empty
    				var newValue = _.without(currentValue, textModel);
    				this.model.set(category, newValue);

	    		}
	    		else{

		    		textModel.set("text", paragraphs);
		    		textModel.trigger("change:text");

	    			//Is this text model set on the EML model?
	    			if( Array.isArray(currentValue) && !_.contains(currentValue, textModel) ){

	    				//Push this text model into the array of EMLText models
	    				currentValue.push(textModel);
	    				this.model.trigger("change:" + category);
		    			this.model.trigger("change");

	    			}

	    		}

	    	}

	    },

	    /*
	     * Creates and returns an array of basic text input field for editing
	     */
	    createBasicTextFields: function(category, placeholder){

	    	var textContainer = $(document.createElement("div")).addClass("text-container"),
	    		modelValues = this.model.get(category),
				textRow; // Holds the DOM for each field

	    	//Format as an array
	    	if(!Array.isArray(modelValues) && modelValues) modelValues = [modelValues];

	    	//For each value in this category, create an HTML element with the value inserted
	    	_.each(modelValues, function(value, i, allModelValues){
		    	if(this.edit){
		    		var textRow = $(document.createElement("div")).addClass("basic-text-row"),
					    input   = $(document.createElement("input"))
				    			.attr("type", "text")
				    			.attr("data-category", category)
				    			.addClass("basic-text");
					textRow.append(input.clone().val(value));

					if(category != "title")
						textRow.append(this.createRemoveButton(null, category, 'div.basic-text-row', 'div.text-container'));

					textContainer.append(textRow);

		    		//At the end, append an empty input for the user to add a new one
		    		if(i+1 == allModelValues.length && category != "title") {
						var newRow = $($(document.createElement("div")).addClass("basic-text-row"));
						newRow.append(input.clone().addClass("new").attr("placeholder", placeholder || "Add a new " + category));
						textContainer.append(newRow);
					}

		    	}
		    	else{
		    		textContainer.append($(document.createElement("div"))
		    				.addClass("basic-text-row")
			    			.attr("data-category", category)
			    			.text(value));
		    	}
	    	}, this);

	    	if((!modelValues || !modelValues.length) && this.edit){
	    		var input = $(document.createElement("input"))
			    			.attr("type", "text")
			    			.attr("data-category", category)
			    			.addClass("basic-text new")
			    			.attr("placeholder", placeholder || "Add a new " + category);

	    		textContainer.append($(document.createElement("div")).addClass("basic-text-row").append(input));
	    	}

	    	return textContainer;
	    },

	    updateBasicText: function(e){
	    	if(!e) return false;

	    	//Get the category, new value, and model
	    	var category = $(e.target).attr("data-category"),
	    		value    = this.model.cleanXMLText($(e.target).val()),
	    		model    = $(e.target).data("model") || this.model;

	    	//We can't update anything without a category
	    	if(!category) return false;

	    	//Get the current value
	    	var currentValue = model.get(category);

	    	//Insert the new value into the array
	    	if( Array.isArray(currentValue) ){

	    		//Find the position this text input is in
	    		var position = $(e.target).parents("div.text-container").first().children("div").index($(e.target).parent());

	    		//Set the value in that position in the array
	    		currentValue[position] = value;

	    		//Set the changed array on this model
	    		model.set(category, currentValue);
	    		model.trigger("change:" + category);

	    	}
	    	//Update the model if the current value is a string
	    	else if(typeof currentValue == "string"){
	    		model.set(category, [value]);
	    		model.trigger("change:" + category);
	    	}
	    	else if(!currentValue) {
				model.set(category, [value]);
				model.trigger("change:" + category);
			}

    		//Add another blank text input
	    	if($(e.target).is(".new") && value != '' && category != "title"){
				$(e.target).removeClass("new");
				this.addBasicText(e);
	    	}

			// Trigger a change on the entire package
			MetacatUI.rootDataPackage.packageModel.set("changed", true);

		},

		/* One-off handler for updating pubDate on the model when the form
		input changes. Fairly similar but just a pared down version of
		updateBasicText. */
		updatePubDate: function(e){
	    	if(!e) return false;

			this.model.set('pubDate', $(e.target).val().trim());
			this.model.trigger("change");

			// Trigger a change on the entire package
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
	    },

	    /*
	     * Adds a basic text input
	     */
	    addBasicText: function(e){
	    	var category = $(e.target).attr("data-category"),
	    		allBasicTexts = $(".basic-text.new[data-category='" + category + "']");

	    	//Only show one new row at a time
    		if((allBasicTexts.length == 1) && !allBasicTexts.val())
    			return;
    		else if(allBasicTexts.length > 1)
    			return;
    		//We are only supporting one title right now
    		else if(category == "title")
    			return;

	    	//Add another blank text input
			var newRow = $(document.createElement("div")).addClass("basic-text-row");

			newRow.append($(document.createElement("input"))
				.attr("type", "text")
				.attr("data-category", category)
				.attr("placeholder", $(e.target).attr("placeholder"))
				.addClass("new basic-text"));

	    	$(e.target).parent().after(newRow);

			$(e.target).after(this.createRemoveButton(null, category, '.basic-text-row', "div.text-container"));
	    },

	    previewTextRemove: function(e){
	    	$(e.target).parents(".basic-text-row").toggleClass("remove-preview");
	    },

		// publication date validation.
		isDateFormatValid: function(dateString){

			//Date strings that are four characters should be a full year. Make sure all characters are numbers
			if(dateString.length == 4){
				var digits = dateString.match( /[0-9]/g );
				return (digits.length == 4)
			}
			//Date strings that are 10 characters long should be a valid date
			else{
				var dateParts = dateString.split("-");

				if(dateParts.length != 3 || dateParts[0].length != 4 || dateParts[1].length != 2 || dateParts[2].length != 2)
					return false;

				dateYear = dateParts[0];
				dateMonth = dateParts[1];
				dateDay = dateParts[2];

				// Validating the values for the date and month if in YYYY-MM-DD format.
				if (dateMonth < 1 || dateMonth > 12)
					return false;
				else if (dateDay < 1 || dateDay > 31)
					return false;
				else if ((dateMonth == 4 || dateMonth == 6 || dateMonth == 9 || dateMonth == 11) && dateDay == 31)
					return false;
				else if (dateMonth == 2) {
				// Validation for leap year dates.
					var isleap = (dateYear % 4 == 0 && (dateYear % 100 != 0 || dateYear % 400 == 0));
					if ((dateDay > 29) || (dateDay == 29 && !isleap))
						return false;
				}

				var digits = _.filter(dateParts, function(part){
					return (part.match( /[0-9]/g ).length == part.length);
				});

				return (digits.length == 3);
			}
		},

		/* Event handler for showing validation messaging for the pubDate input
		which has to conform to the EML yearDate type (YYYY or YYYY-MM-DD) */
		showPubDateValidation: function(e) {
			var container = $(e.target).parents(".pubDate").first(),
				input = $(e.target),
				messageEl = $(container).find('.notification'),
				value = input.val(),
				errors = [];

			// Remove existing error borders and notifications
			input.removeClass("error");
			messageEl.text("");
			messageEl.removeClass("error");

			if (value != "" && value.length > 0) {
				if (!this.isDateFormatValid(value)) {
					errors.push("The value entered for publication date, '" +
						value +
						"' is not a valid value for this field. Enter either a year (e.g. 2017) or a date in the format YYYY-MM-DD.");

						input.addClass("error")
				}
			}

			if (errors.length > 0) {
				messageEl.text(errors[0]).addClass("error");
			}
		},

		// Creates a table to hold a single EMLTaxonCoverage element (table) for
		// each root-level taxonomicClassification
		createTaxonomicCoverage: function(coverage) {
            var finishedEls = $(this.taxonomicCoverageTemplate({
            		generalTaxonomicCoverage: coverage.get('generalTaxonomicCoverage') || ""
            	})),
            	coverageEl = finishedEls.filter(".taxonomic-coverage");

            coverageEl.data({ model: coverage });

			var classifications = coverage.get("taxonomicClassification");

			// Makes a table... for the root level
			for (var i = 0; i < classifications.length; i++) {
				coverageEl.append(this.createTaxonomicClassifcationTable(classifications[i]));
			}

			// Create a new, blank table for another taxonomicClassification
			var newTableEl = this.createTaxonomicClassifcationTable();

			coverageEl.append(newTableEl);

			return finishedEls;
		},

		createTaxonomicClassifcationTable: function(classification) {

            // updating the taxonomic table indexes before adding a new table to the page.
            var taxaNums = this.$(".editor-header-index");
            for (var i = 0; i < taxaNums.length; i++) {
                $(taxaNums[i]).text(i + 1);
            }

            // Adding the taxoSpeciesCounter to the table header for enhancement of the view
            var finishedEl = $('<div class="row-striped root-taxonomic-classification-container"></div>');
            $(finishedEl).append('<h6>Species <span class="editor-header-index">' + (taxaNums.length + 1) + '</span> </h6>');


			// Add a remove button if this is not a new table
			if (!(typeof classification === "undefined")) {
				$(finishedEl).append(this.createRemoveButton('taxonCoverage', 'taxonomicClassification', '.root-taxonomic-classification-container', '.taxonomic-coverage'));
			}


			var tableEl = $(this.taxonomicClassificationTableTemplate());
			var tableBodyEl = $(document.createElement("tbody"));

			var queue = [classification],
			 	rows = [],
			 	cur;

			while (queue.length > 0) {
				cur = queue.pop();

				// I threw this in here so I can this function without an
				// argument to generate a new table from scratch
				if (typeof cur === "undefined") {
					continue;
				}

				rows.push({
					'taxonRankName' : cur.taxonRankName.toLowerCase(),
					'taxonRankValue' : cur.taxonRankValue
				});

				if (cur.taxonomicClassification) {
					for (var i = 0; i < cur.taxonomicClassification.length; i++) {
						queue.push(cur.taxonomicClassification[i]);
					}
				}
			}

			for (var j = 0; j < rows.length; j++) {
				tableBodyEl.append(this.taxonomicClassificationRowTemplate(rows[j]));
			}

			var newRowEl = $(this.taxonomicClassificationRowTemplate({
				taxonRankName: '',
				taxonRankValue: ''
			}));

			$(newRowEl).addClass("new");
			$(tableBodyEl).append(newRowEl);
			$(tableEl).append(tableBodyEl);

			// Add the new class to the entire table if it's a new one
			if (typeof classification === "undefined") {
				$(tableEl).addClass("new");
			}

			$(finishedEl).append(tableEl);

			return finishedEl;
		},

		/* Update the underlying model and DOM for an EML TaxonomicCoverage
		section. This method handles updating the underlying TaxonomicCoverage
		models when the user changes form fields as well as inserting new
		form fields automatically when the user needs them.

		Since a dataset has multiple TaxonomicCoverage elements at the dataset
		level, each Taxonomic Coverage is represented by a table element and
		all taxonomicClassifications within are rows in that table.

		TODO: Finish this function
		TODO: Link this function into the DOM
		*/
		updateTaxonCoverage: function(options) {

			if(options.target){
				var e = options;

				/*	Getting `model` here is different than in other places because
					the thing being updated is an `input` or `select` element which
					is part of a `taxonomicClassification`. The model is
					`TaxonCoverage` which has one or more
					`taxonomicClassifications`. So we have to walk up to the
					hierarchy from input < td < tr < tbody < table < div to get at
					the underlying TaxonCoverage model.
				*/
		    	var coverage = $(e.target).parents(".taxonomic-coverage"),
					classificationEl = $(e.target).parents(".root-taxonomic-classification"),
		    		model =  $(coverage).data("model") || this.model,
					category = $(e.target).attr("data-category"),
					value = this.model.cleanXMLText($(e.target).val());

		    	//We can't update anything without a coverage, or
		    	//classification
				if (!coverage) return false;
				if (!classificationEl) return false;

				// Use `category` to determine if we're updating the generalTaxonomicCoverage or
				// the taxonomicClassification
				if (category && category === "generalTaxonomicCoverage") {
					model.set('generalTaxonomicCoverage', value);

					return;
				}
			}
			else{
				var coverage = options.coverage,
					model    = $(coverage).data("model");
			}

			// Find all of the root-level taxonomicClassifications
			var classificationTables = $(coverage).find(".root-taxonomic-classification");

			if (!classificationTables) return false;

			//TODO :This should probably (at least) be in its own View and
			//definitely refactored into tidy functions.*/

			var rows,
				collectedClassifications = [];

			for (var i = 0; i < classificationTables.length; i++) {

				rows = $(classificationTables[i]).find("tbody tr");

				if (!rows) continue;

				var topLevelClassification = {},
					classification = topLevelClassification,
					currentRank,
					currentValue;

				for (var j = 0; j < rows.length; j++) {

					currentRank = this.model.cleanXMLText($(rows[j]).find("select").val()) || "";
					currentValue = this.model.cleanXMLText($(rows[j]).find("input").val()) || "";

					// Skip over rows with empty Rank or Value
					if (!currentRank.length || !currentValue.length) {
						continue;
					}

					//After the first row, start nesting taxonomicClassification objectss
					if(j > 0){
						classification.taxonomicClassification = {};
						classification = classification.taxonomicClassification;
					}

					// Add it to the classification object
					classification.taxonRankName = currentRank;
					classification.taxonRankValue = currentValue;

				}


				//Add the top level classification to the array
				if(Object.keys(topLevelClassification).length)
					collectedClassifications.push(topLevelClassification);
			}

			if (!(_.isEqual(collectedClassifications, model.get('taxonomicClassification')))) {
				model.set('taxonomicClassification', collectedClassifications);
				this.model.trigger("change");
			}

			// Handle adding new tables and rows
			// Do nothing if the value isn't set
			if (value) {
				// Add a new row if this is itself a new row
				if ($(e.target).parents("tr").first().is(".new")) {
					var newRowEl = $(this.taxonomicClassificationRowTemplate({
						taxonRankName: '',
						taxonRankValue: ''
					})).addClass("new");

					$(e.target).parents("tbody").first().append(newRowEl);
					$(e.target).parents("tr").first().removeClass("new");
				}

				// Add a new classification table if this is itself a new table
				if ($(classificationEl).is(".new")) {
					$(classificationEl).removeClass("new");
					$(classificationEl).append(this.createRemoveButton('taxonCoverage', 'taxonomicClassification', '.root-taxonomic-classification-container', '.taxonomic-coverage'));
					$(coverage).append(this.createTaxonomicClassifcationTable());
				}
			}
		},

		/*
		 * Adds a new row and/or table to the taxonomic coverage section
		 */
		addNewTaxon: function(e){
			// Don't do anything if the current classification doesn't have new content
			if ($(e.target).val().trim() === "") return;

			// If the row is new, add a new row to the table
			if ($(e.target).parents("tr").is(".new")) {
				var newRow = $(this.taxonomicClassificationRowTemplate({
								taxonRankName: '',
								taxonRankValue: ''
							 }))
							 .addClass("new");

				//Append the new row and remove the new class from the old row
				$(e.target).parents("tr").removeClass("new").after(newRow);
			}
		},

		removeTaxonRank: function(e){
			var row = $(e.target).parents(".taxonomic-coverage-row"),
				coverageEl = $(row).parents(".taxonomic-coverage"),
				view = this;

			//Animate the row away and then remove it
			row.slideUp("fast", function(){
				row.remove();
				view.updateTaxonCoverage({ coverage: coverageEl });
			});
		},

		/*
		 * After the user focuses out, show validation help, if needed
		 */
		showTaxonValidation: function(e){

			//Get the text inputs and select menus
			var row = $(e.target).parents("tr"),
				allInputs = row.find("input, select"),
				tableContainer = $(e.target).parents("table"),
				errorInputs = [];

			//If none of the inputs have a value and this is a new row, then do nothing
			if(_.every(allInputs, function(i){ return !i.value }) && row.is(".new"))
				return;

			//Add the error styling to any input with no value
			_.each(allInputs, function(input){
				// Keep track of the number of clicks of each input element so we only show the
				// error message after the user has focused on both input elements
				if(!input.value)
					errorInputs.push(input);
			});

			if(errorInputs.length){

				//Show the error message after a brief delay
				setTimeout(function(){
					//If the user focused on another element in the same row, don't do anything
					if(_.contains(allInputs, document.activeElement))
						return;

					//Add the error styling
					$(errorInputs).addClass("error");

					//Add the error message
					if( !tableContainer.prev(".notification").length ){
						tableContainer.before($(document.createElement("p"))
														.addClass("error notification")
														.text("Enter a rank name AND value in each row."));
					}

				}, 200);
			}
			else{
				allInputs.removeClass("error");

				if(!tableContainer.find(".error").length)
					tableContainer.prev(".notification").remove();
			}

		},

		previewTaxonRemove: function(e){
			var removeBtn = $(e.target);

			if(removeBtn.parent().is(".root-taxonomic-classification")){
				removeBtn.parent().toggleClass("remove-preview");
			}
			else{
				removeBtn.parents(".taxonomic-coverage-row").toggleClass("remove-preview");
			}

		},

        updateRadioButtons: function(e){
        	//Get the element of this radio button set that is checked
        	var choice = this.$("[name='" + $(e.target).attr("name") + "']:checked").val();

        	if(typeof choice == "undefined" || !choice)
        		this.model.set($(e.target).attr("data-category"), "");
        	else
        		this.model.set($(e.target).attr("data-category"), choice);

        	this.model.trickleUpChange();
        },

        /*
         * Switch to the given section
         */
        switchSection: function(e){
        	if(!e) return;

        	e.preventDefault();

        	var clickedEl = $(e.target),
        		section = clickedEl.attr("data-section") ||
        				  clickedEl.children("[data-section]").attr("data-section") ||
        				  clickedEl.parents("[data-section]").attr("data-section");

        	if(this.visibleSection == "all")
        		this.scrollToSection(section);
        	else{
        		this.$(".section." + this.activeSection).hide()
        		this.$(".section." + section).show();

        		this.highlightTOC(section);

        		this.activeSection = section;
        		this.visibleSection = section;

        		$("body").scrollTop(this.$(".section." + section).offset().top - $("#Navbar").height());
        	}


        },

        /*
         * When a user clicks on the section names in the side tabs, jump to the section
         */
        scrollToSection: function(e){
        	if(!e) return false;

        	//Stop navigation
        	e.preventDefault();

        	var section = $(e.target).attr("data-section"),
        		sectionEl = this.$(".section." + section);

        	if(!sectionEl) return false;

        	//Temporarily unbind the scroll listener while we scroll to the clicked section
        	$(document).unbind("scroll");

        	var view = this;
        	setTimeout(function(){
        		$(document).scroll(view.highlightTOC.call(view));
        	}, 1500);

        	//Scroll to the section
        	if(sectionEl == section[0])
        		MetacatUI.appView.scrollToTop();
        	else
        		MetacatUI.appView.scrollTo(sectionEl, $("#Navbar").outerHeight());

        	//Remove the active class from all the menu items
        	$(".side-nav-item a.active").removeClass("active");
        	//Set the clicked item to active
        	$(".side-nav-item a[data-section='" + section + "']").addClass("active");

        	//Set the active section on this view
        	this.activeSection = section;
        },

        /*
         * Highlight the given menu item.
         * The first argument is either an event object or the section name
         */
        highlightTOC: function(section){

        	this.resizeTOC();

        	//Now change sections
        	if(typeof section == "string"){
            	//Remove the active class from all the menu items
            	$(".side-nav-item a.active").removeClass("active");

            	$(".side-nav-item a[data-section='" + section + "']").addClass("active");
            	this.activeSection = section;
            	this.visibleSection = section;
            	return;
        	}
        	else if(this.visibleSection == "all"){
            	//Remove the active class from all the menu items
            	$(".side-nav-item a.active").removeClass("active");

        		//Get the section
        		var top = $(window).scrollTop() + $("#Navbar").outerHeight() + 70,
        			sections = $(".metadata-container .section");

        		//If we're somewhere in the middle, find the right section
    			for(var i=0; i < sections.length; i++){
    				if( top > $(sections[i]).offset().top && top < $(sections[i+1]).offset().top ){
    					$($(".side-nav-item a")[i]).addClass("active");
    					this.activeSection = $(sections[i]).attr("data-section");
    					this.visibleSection = $(sections[i]).attr("data-section");
    					break;
    				}
    			}


        	}
        },

    	/*
    	 * Resizes the vertical table of contents so it's always the same height as the editor body
    	 */
        resizeTOC: function(){
        	var tableBottomHandle = $("#editor-body .ui-resizable-handle");

          if( !tableBottomHandle.length )
            return;

          var tableBottom = tableBottomHandle[0].getBoundingClientRect().bottom,
        		  navTop = tableBottom;

        	if(tableBottom < $("#Navbar").outerHeight()){
        		if( $("#Navbar").css("position") == "fixed" )
        			navTop = $("#Navbar").outerHeight();
        		else
        			navTop = 0;
        	}


        	$(".metadata-toc").css("top", navTop);
        },

        /*
         *  -- This function is for development/testing purposes only --
         *  Trigger a change on all the form elements
		 *	so that when values are changed by Javascript, we make sure the change event
		 *  is fired. This is good for capturing changes by Javascript, or
		 *  browser plugins that fill-in forms, etc.
         */
        triggerChanges: function(){
			$("#metadata-container input").change();
			$("#metadata-container textarea").change();
			$("#metadata-container select").change();
        },

		/* Creates "Remove" buttons for removing non-required sections
		of the EML from the DOM */
		createRemoveButton: function(submodel, attribute, selector, container) {
			return $(document.createElement("span"))
				.addClass("icon icon-remove remove pointer")
				.attr("title", "Remove")
				.data({
					'submodel' : submodel,
					'attribute': attribute,
					'selector': selector,
					'container': container
				})
		},

		/* Generic event handler for removing sections of the EML (both
		the DOM and inside the EML211Model) */
		handleRemove: function(e) {
  			var submodel = $(e.target).data('submodel'), // Optional sub-model to remove attribute from
  			    attribute = $(e.target).data('attribute'), // Attribute on the EML211 model we're removing from
  			    selector = $(e.target).data('selector'), // Selector to find the parent DOM elemente we'll remove
  				  container = $(e.target).data('container'), // Selector to find the parent container so we can remove by index
  				  parentEl, // Element we'll remove
  				  model; // Specific sub-model we're removing

  			if (!attribute) return;
  			if (!container) return;

  			// Find the element we'll remove from the DOM
  			if (selector) {
  				parentEl = $(e.target).parents(selector).first();
  			} else {
  				parentEl = $(e.target).parents().first();
  			}

  			if (parentEl.length == 0) return;

  			// Handle remove on a EML model / sub-model
  			if (submodel) {

  				  model = this.model.get(submodel);

  				  if (!model) return;

    				// Get the current value of the attribute so we can remove from it
    				var currentValue,
    					submodelIndex;

    				if (Array.isArray(this.model.get(submodel))) {
    					// Stop now if there's nothing to remove in the first place
    					if (this.model.get(submodel).length == 0) return;

    					// For multi-valued submodels, find *which* submodel we are removing or
    					// removingn from
    					submodelIndex = $(container).index($(e.target).parents(container).first());
    					if (submodelIndex === -1) return;

    					currentValue = this.model.get(submodel)[submodelIndex].get(attribute);
    				} else {
    					currentValue = this.model.get(submodel).get(attribute);
    				}

    				//FInd the position of this field in the list of fields
    				var position = $(e.target).parents(container)
    								.first()
    								.children(selector)
    								.index($(e.target).parents(selector));

    				// Remove from the EML Model
    				if (position >= 0) {
    					if (Array.isArray(this.model.get(submodel))) {
    						currentValue.splice(position, 1); // Splice returns the removed members
    						this.model.get(submodel)[submodelIndex].set(attribute, currentValue);
    					} else {
    						currentValue.splice(position, 1); // Splice returns the removed members
    						this.model.get(submodel).set(attribute, currentValue);
    					}

    				}

    			} else if (selector) {
    				// Find the index this attribute is in the DOM
    				var position = $(e.target).parents(container).first()
                          .children(selector)
                          .index($(e.target).parents(selector));

    				//Remove this index of the array
    				var currentValue = this.model.get(attribute);

    				if( Array.isArray(currentValue) )
    					currentValue.splice(position, 1);

    				//Set the array on the model so the 'set' function is executed
    				this.model.set(attribute, currentValue);

      			}
            // Handle remove on a basic text field
            else {
      				// The DOM order matches the EML model attribute order so we can remove
      				// by that
      				var position = $(e.target).parents(container).first().children(selector).index(selector);
      				var currentValue = this.model.get(attribute);

      				// Remove from the EML Model
      				if (position >= 0) {
      					currentValue.splice(position, 1);
      					this.model.set(attribute, currentValue);
      				}
      			}

      			// Trigger a change on the entire package
      			MetacatUI.rootDataPackage.packageModel.set("changed", true);

      			// Remove the DOM
      			$(parentEl).remove();

            //updating the tablesIndex once the element has been removed
            var tableNums = this.$(".editor-header-index");
            for (var i = 0; i < tableNums.length; i++) {
                $(tableNums[i]).text(i + 1);
            }
		    },

        /* Close the view and its sub views */
        onClose: function() {
            this.remove(); // remove for the DOM, stop listening
            this.off();    // remove callbacks, prevent zombies
            this.model.off();

            //Remove the scroll event listeners
            $(document).unbind("scroll");

            this.model = null;

            this.subviews = [];
			      window.onbeforeunload = null;

        }
    });
    return EMLView;
});
