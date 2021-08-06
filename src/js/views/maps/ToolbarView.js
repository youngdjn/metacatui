
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Map',
    'text!templates/maps/toolbar.html',
    // Sub-views
    'views/maps/LayersView'
  ],
  function (
    $,
    _,
    Backbone,
    Map,
    Template,
    // Sub-views
    LayersView
  ) {

    /**
    * @class ToolbarView
    * @classdesc The map toolbar view is a side bar that contains information about a map,
    * including the available layers, plus UI for changing the settings of a map.
    * @classcategory Views/Maps
    * @name ToolbarView
    * @extends Backbone.View
    * @screenshot maps/ToolbarView.png // TODO: add screenshot
    * @constructs
    */
    var ToolbarView = Backbone.View.extend(
      /** @lends ToolbarView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'ToolbarView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'toolbar',

        /**
        * The model that this view uses
        * @type {Map}
        */
        model: undefined,

        /**
         * The primary HTML template for this view. The template must have three element,
         * one with the contentContainer class, one with the linksContainer class, and one
         * with the toggle class. See {@link ToolbarView#classes}.
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * The classes of the sub-elements that combined to create a toolbar view.
         *
         * @name ToolbarView#classes
         * @type {Object}
         * @property {string} open The class to add to the view when the toolbar is open
         * (and the content is visible)
         * @property {string} contentContainer The element that contains all containers
         * for the toolbar section content. This element must be part of this view's
         * template.
         * @property {string} toggle The element in the template that acts as a toggle to
         * close the toolbar.
         * @property {string} linksContainer The container for all of the section links
         * (i.e. tabs)
         * @property {string} link A section link
         * @property {string} linkTitle The section link title
         * @property {string} linkIcon The section link icon
         * @property {string} linkActive The class to add to a link when its content is
         * active
         * @property {string} content A section's content. This element will be the
         * container for the view associated with this section.
         * @property {string} contentActive A class added to a content container when it
         * is the active section
         */
        classes: {
          open: 'toolbar--open',
          contentContainer: 'toolbar__all-content',
          toggle: 'toolbar__toggle',
          linksContainer: 'toolbar__links',
          link: 'toolbar__link',
          linkTitle: 'toolbar__link-title',
          linkIcon: 'toolbar__link-icon',
          linkActive: 'toolbar__link--active',
          content: 'toolbar__content',
          contentActive: 'toolbar__content--active'
        },

        /**
        * Creates an object that gives the events this view will listen to and the
        * associated function to call. Each entry in the object has the format 'event
        * selector': 'function'.
        * @returns {Object}
        */
        events: function () {
          var events = {};
          // Close the toolbar when the toggle button is clicked. Get the class of the
          // toggle button from the classes property set in this view.
          events['click .' + this.classes.toggle] = 'close'
          return events
        },

        /**
         * Options/settings that are used to create a toolbar section and its associated
         * link/tab.
         *
         * @typedef {Object} SectionOption
         * @property {string} label The name of this section to show to the user.
         * @property {string} icon The name of the icon to use to show in the link (tab)
         * for this section.
         * @property {ToolbarSectionView} view The view that renders the content of the
         * toolbar section.
         * @property {object} viewOptions Any addition options to pass to the
         * ToolbarSectionView. Note that the Map model will always be passed to the view.
         */

        /**
         * The sections displayed in the toolbar will be created based on the options set
         * in this array.
         * 
         * @type {SectionOption[]}
         */
        sections: [
          {
            label: 'Layers',
            icon: 'map-marker',
            view: LayersView,
            viewOptions: {}
          }
        ],

        /**
         * Whether or not the toolbar menu is opened. This will get updated when the user
         * interacts with the toolbar links.
         * @type {Boolean}
         */
        isOpen: false,

        /**
        * Executed when a new ToolbarView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A ToolbarView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {ToolbarView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Set the toolbar to open, depending on what is initially set in view.isOpen
            if (this.isOpen) {
              this.el.classList.add(this.classes.open)
            }

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Select and save a reference to the elements that will contain the
            // links/tabs and the section content.
            this.contentContainer = document.querySelector(
              '.' + view.classes.contentContainer
            )
            this.linksContainer = document.querySelector(
              '.' + view.classes.linksContainer
            )

            // sectionElements will store the section link, section content element, and
            // the status of the given section (whether it is active or not)
            this.sectionElements = [];

            // For each section configured in the view's sections property, create a link
            // and render the content. Set a listener for when the link is clicked. 
            this.sections.forEach(function (sectionOption) {
              // Render the link and content elements
              var linkEl = view.renderSectionLink(sectionOption)
              var contentEl = view.renderSectionContent(sectionOption)
              // Set the section to false to start
              var isActive = false
              // Save a reference to these elements and their status. sectionEl is an
              // object that has type SectionElement (documented in comments below)
              var sectionEl = { linkEl, contentEl, isActive }
              view.sectionElements.push(sectionEl)
              // Attach the link and content to the view
              view.contentContainer.appendChild(contentEl);
              view.linksContainer.appendChild(linkEl);
              // Add a listener that shows the section when the link is clicked
              linkEl.addEventListener('click', function () {
                view.handleLinkClick(sectionEl)
              });
            })

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * A reference to all of the elements required to make up a toolbar section: the
         * section content and the section link (i.e. tab); as well as the status of the
         * section: active or in active.
         *
         * @typedef {Object} SectionElement
         * @property {HTMLElement} contentEl The element that contains the toolbar
         * section's content (the content rendered by the associated view)
         * @property {HTMLElement} linkEl The element that acts as a link to show the
         * section's content, and open/close the toolbar.
         * @property {Boolean} isActive True if this is the active section, false
         * otherwise.
         */

        /**
         * Executed when any one of the tabs/links are clicked. Opens the toolbar if it's
         * closed, closes it if the active section is clicked, and otherwise activates the
         * clicked section content.
         * @param {SectionElement} sectionEl
         */
        handleLinkClick: function (sectionEl) {
          try {
            var toolbarOpen = this.isOpen;
            var sectionActive = sectionEl.isActive;
            if (toolbarOpen && sectionActive) {
              this.close()
              return
            }
            if (!toolbarOpen) {
              this.open()
            }
            if (!sectionActive) {
              this.inactivateAllSections()
              this.activateSection(sectionEl)
            }
          }
          catch (error) {
            console.log(
              'There was an error handling a toolbar link click in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a link/tab for a given toolbar section
         * @param {SectionOption} sectionOption The label and icon that are set in the
         * Section Option are used to create the link content
         * @returns {HTMLElement} Returns the link element
         */
        renderSectionLink: function (sectionOption) {
          try {

            // Create a container, label, and, icon
            var link = document.createElement('div')
            var title = document.createElement('div')
            var icon = document.createElement('i')

            // Insert the icon
            icon.className = 'icon-' + sectionOption.icon;

            // Add the relevant classes
            link.classList.add(this.classes.link)
            title.classList.add(this.classes.linkTitle)
            icon.classList.add(this.classes.linkIcon)

            // Add the content
            title.textContent = sectionOption.label

            link.appendChild(icon)
            link.appendChild(title)

            return link
          }
          catch (error) {
            console.log(
              'There was an error rendering a section link in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a container for a toolbar section's content, then rendered the
         * specified view in that container.
         * @param {SectionOption} sectionOption The view and view options that are set in
         * the Section Option are used to create the content container
         * @returns {HTMLElement} Returns the content container with the rendered view
         */
        renderSectionContent: function (sectionOption) {
          try {
            // Create the container for the toolbar section content
            var contentContainer = document.createElement('div')
            // Add the class that identifies a toolbar section's content
            contentContainer.classList.add(this.classes.content)
            // Render the toolbar section view
            // Merge the icon and label with the other section options
            var viewOptions = Object.assign(
              {
                label: sectionOption.label,
                icon: sectionOption.icon,
                model: this.model
              },
              sectionOption.viewOptions
            )
            var sectionContent = new sectionOption.view(viewOptions)
            contentContainer.appendChild(sectionContent.el)
            sectionContent.render()
            return contentContainer
          }
          catch (error) {
            console.log(
              'There was an error rendering section content in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Opens the toolbar and displays the content of the active toolbar section
         */
        open: function () {
          try {
            this.isOpen = true
            this.el.classList.add(this.classes.open)
          }
          catch (error) {
            console.log(
              'There was an error opening a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Closes the toolbar. Also inactivates all sections.
         */
        close: function () {
          try {
            this.isOpen = false
            this.el.classList.remove(this.classes.open)
            // Ensure that no section is active when the toolbar is closed
            this.inactivateAllSections()
          }
          catch (error) {
            console.log(
              'There was an error closing a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Display the content of a given section
         * @param {SectionElement} sectionEl The section to activate
         */
        activateSection: function (sectionEl) {
          try {
            sectionEl.isActive = true;
            sectionEl.contentEl.classList.add(this.classes.contentActive)
            sectionEl.linkEl.classList.add(this.classes.linkActive)
          }
          catch (error) {
            console.log(
              'There was an error showing a toolbar section in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide the content of a section
         * @param {SectionElement} sectionEl The section to inactivate
         */
        inactivateSection: function (sectionEl) {
          try {
            sectionEl.isActive = false;
            sectionEl.contentEl.classList.remove(this.classes.contentActive)
            sectionEl.linkEl.classList.remove(this.classes.linkActive)
          }
          catch (error) {
            console.log(
              'There was an error showing a toolbar section in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide all of the sections in a toolbar view
         */
        inactivateAllSections: function () {
          try {
            var view = this;
            this.sectionElements.forEach(function (sectionEl) {
              view.inactivateSection(sectionEl)
            })
          }
          catch (error) {
            console.log(
              'There was an error hiding toolbar sections in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return ToolbarView;

  }
);
