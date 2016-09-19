/*global rg2:false */
/*global rg2Config:false */
/*global console */
(function () {
  function reportJSONFail(errorText) {
    $("#rg2-load-progress").hide();
    $("#rg2-map-load-progress").hide();
    $('body').css('cursor', 'auto');
    rg2.utils.showWarningDialog('Configuration error', errorText);
  }

  function getEvents() {
    var eventID;
    $.getJSON(rg2Config.json_url, {
      type : "events",
      cache : false
    }).done(function (json) {
      console.log("Events: " + json.data.events.length);
      rg2.events.deleteAllEvents();
      $.each(json.data.events, function () {
        rg2.events.addEvent(new rg2.Event(this));
      });
      rg2.ui.createEventMenu();
      // load requested event if set
      // input is kartat ID so need to find internal ID first
      if (rg2.requestedHash.getID()) {
        eventID = rg2.events.getEventIDForKartatID(rg2.requestedHash.getID());
        if (eventID !== undefined) {
          rg2.loadEvent(eventID);
        }
      }
      if (rg2.config.managing) {
        rg2.manager.eventListLoaded();
      }
    }).fail(function (jqxhr, textStatus, error) {
      /*jslint unparam:true*/
      reportJSONFail("Events request failed: " + error);
    });
  }
  function getGPSTracks() {
    $("#rg2-load-progress-label").text(rg2.t("Loading routes"));
    $.getJSON(rg2Config.json_url, {
      id : rg2.events.getKartatEventID(),
      type : "tracks",
      cache : false
    }).done(function (json) {
      var active, i, event, routes, crs;
      $("#rg2-load-progress-label").text(rg2.t("Saving routes"));
      console.log("Tracks: " + json.data.routes.length);
      // TODO remove temporary (?) fix to get round RG1 events with no courses defined: see #179
      if (rg2.courses.getNumberOfCourses() > 0) {
        rg2.results.addTracks(json.data.routes);
      }
      rg2.ui.createCourseMenu();
      rg2.ui.createResultMenu();
      rg2.animation.updateAnimationDetails();
      $('body').css('cursor', 'auto');
      if (rg2.config.managing) {
        rg2.manager.eventFinishedLoading();
      } else {
        $("#rg2-info-panel").tabs("enable", rg2.config.TAB_COURSES);
        $("#rg2-info-panel").tabs("enable", rg2.config.TAB_RESULTS);
        if (rg2.events.eventIsLocked()) {
          $("#rg2-info-panel").tabs("disable", rg2.config.TAB_DRAW);
        } else {
          $("#rg2-info-panel").tabs("enable", rg2.config.TAB_DRAW);
        }
        // open courses tab for new event: else stay on draw tab
        active = $("#rg2-info-panel").tabs("option", "active");
        // don't change tab if we have come from DRAW since it means
        // we have just reloaded following a save
        if (active !== rg2.config.TAB_DRAW) {
          $("#rg2-info-panel").tabs("option", "active", rg2.requestedHash.getTab());
        }
        $("#rg2-info-panel").tabs("refresh");
        $("#btn-show-splits").show();
        if ((rg2Config.enable_splitsbrowser) && (rg2.events.hasResults())) {
          $("#rg2-splitsbrowser").off().click(function () {
            window.open(rg2Config.json_url + "?type=splitsbrowser&id=" + rg2.events.getKartatEventID());
          }).show();
        } else {
          $("#rg2-splitsbrowser").off().hide();
        }
        // set up screen as requested in hash
        event = $.Event('click');
        event.target = {};
        event.target.checked = true;
        routes = rg2.requestedHash.getRoutes();
        for (i = 0; i < routes.length; i += 1) {
          event.target.id = routes[i];
          $(".showtrack").filter("#" + routes[i]).trigger(event).prop('checked', true);
        }
        crs = rg2.requestedHash.getCourses();
        for (i = 0; i < crs.length; i += 1) {
          event.target.id = crs[i];
          $(".showcourse").filter("#" + crs[i]).trigger(event).prop('checked', true);
        }
      }
      $("#rg2-load-progress-label").text("");
      $("#rg2-load-progress").hide();
      rg2.redraw(false);
    }).fail(function (jqxhr, textStatus, error) {
      /*jslint unparam:true*/
      reportJSONFail("Routes request failed for event " + rg2.events.getKartatEventID() + ": " + error);
    });
  }

  function getResults() {
    var isScoreEvent;
    $("#rg2-load-progress-label").text(rg2.t("Loading results"));
    $.getJSON(rg2Config.json_url, {
      id : rg2.events.getKartatEventID(),
      type : "results",
      cache : false
    }).done(function (json) {
      console.log("Results: " + json.data.results.length);
      $("#rg2-load-progress-label").text(rg2.t("Saving results"));
      isScoreEvent = rg2.events.isScoreEvent();
      // TODO remove temporary (?) fix to get round RG1 events with no courses defined: see #179
      if (rg2.courses.getNumberOfCourses() > 0) {
        rg2.results.addResults(json.data.results, isScoreEvent);
      }
      rg2.courses.setResultsCount();
      if (isScoreEvent) {
        rg2.controls.deleteAllControls();
        rg2.results.generateScoreCourses();
        rg2.courses.generateControlList(rg2.controls);
      }
      $("#rg2-result-list").accordion("refresh");
      getGPSTracks();
    }).fail(function (jqxhr, textStatus, error) {
      /*jslint unparam:true*/
      reportJSONFail("Results request failed for event " + rg2.events.getKartatEventID() + ": " + error);
    });
  }

  function getCourses() {
    // get courses for event
    $.getJSON(rg2Config.json_url, {
      id : rg2.events.getKartatEventID(),
      type : "courses",
      cache : false
    }).done(function (json) {
      $("#rg2-load-progress-label").text(rg2.t("Saving courses"));
      console.log("Courses: " + json.data.courses.length);
      $.each(json.data.courses, function () {
        rg2.courses.addCourse(new rg2.Course(this, rg2.events.isScoreEvent()));
      });
      rg2.courses.updateCourseDropdown();
      rg2.courses.generateControlList(rg2.controls);
      $("#btn-toggle-controls").show();
      $("#btn-toggle-names").show();
      getResults();
    }).fail(function (jqxhr, textStatus, error) {
      /*jslint unparam:true*/
      reportJSONFail("Courses request failed for event " + rg2.events.getKartatEventID() + ": " + error);
    });
  }

  function getNewLanguage(lang) {
    $.getJSON(rg2Config.json_url, {
      id : lang,
      type : 'lang',
      cache : false
    }).done(function (json) {
      rg2.ui.setNewLanguage(json.data.dict);
    }).fail(function (jqxhr, textStatus, error) {
      /*jslint unparam:true*/
      reportJSONFail("Language request failed: " + error);
    });
  }

  rg2.getEvents = getEvents;
  rg2.getCourses = getCourses;
  rg2.getResults = getResults;
  rg2.getGPSTracks = getGPSTracks;
  rg2.getNewLanguage = getNewLanguage;
}());
