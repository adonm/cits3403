"use strict";

angular.module("chatplace", [ "ui.gravatar", "mgcrea.ngStrap" ]).run(function($rootScope, $location, $http) {
    var scope = $rootScope;
    scope.location = $location;
    var loadLeaflet = function(position) {
        if (position == undefined) {
            var position = {
                coords: {
                    longitude: 115.8589,
                    latitude: -31.9522
                }
            };
        }
        // create a map in the "map" div, set the view to a given place and zoom
        window.map = L.map("map").setView([ position.coords.latitude, position.coords.longitude ], 12);
        // add an OpenStreetMap tile layer
        L.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        angular.element(document.getElementById("mapLoadText")).remove();
    };
    scope.loadMap = function() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(loadLeaflet);
        } else {
            setTimeout(loadLeaflet, 50);
        }
    };
    scope.loadWebRTC = function() {
        angular.element(document.getElementById("localVideo")).removeClass("ng-hide");
        var webrtc = new SimpleWebRTC({
            // the id/element dom element that will hold "our" video
            localVideoEl: "localVideo",
            // the id/element dom element that will hold remote videos
            remoteVideosEl: "remotesVideos",
            // immediately ask for camera access
            autoRequestMedia: true
        });
        // we have to wait until it's ready
        webrtc.on("readyToCall", function() {
            // this should poll ruby server and create/get room
            webrtc.joinRoom("defaultRoom");
        });
    };
    $http.get("http://api.randomuser.me/").success(function(data) {
        scope.emailSuffix = data.results[0].user.email + " (Sign In)";
    });
    scope.email = null;
    /* PROPERTIES */
    scope.loginPath = "/login";
    scope.logoutPath = "/logout";
    scope.debug = false;
    /* HANDLERS */
    scope.onLogin = function(data, status, xhr) {
        if (this.debug) {
            return alert("Login: " + status + "\n" + data);
        } else {
            return window.location.reload();
        }
    }, scope.onLoginError = function(xhr, status, err) {
        return alert("Login: " + status + " " + err + "\n" + xhr.responseText);
    }, scope.onLogout = function(data, status, xhr) {
        if (this.debug) {
            return alert("Logout: " + status + "\n" + data);
        } else {
            return window.location.reload();
        }
    }, scope.onLogoutError = function(xhr, status, err) {
        return alert("Logout: " + status + " " + err + "\n" + xhr.responseText);
    }, /* INITIALIZATION */
    scope.setup = function(currentUser) {
        if (currentUser == null) {
            currentUser = null;
        }
        return navigator.id.watch({
            loggedInUser: currentUser,
            onlogin: function(assertion) {
                return $.ajax({
                    type: "POST",
                    url: scope.loginPath,
                    data: {
                        assertion: assertion
                    },
                    success: function(data, status, xhr) {
                        return scope.onLogin(data, status, xhr);
                    },
                    error: function(xhr, status, err) {
                        return scope.onLoginError(xhr, status, err);
                    }
                });
            },
            onlogout: function() {
                return $.ajax({
                    type: "POST",
                    url: scope.logoutPath,
                    success: function(data, status, xhr) {
                        return scope.onLogout(data, status, xhr);
                    },
                    error: function(xhr, status, err) {
                        return scope.onLogoutError(xhr, status, err);
                    }
                });
            }
        });
        $(document).on("click", ".browserid_login", function() {
            navigator.id.request();
            return false;
        });
        $(document).on("click", ".browserid_logout", function() {
            navigator.id.logout();
            return false;
        });
    };
    scope.searchLocation = null;
    scope.zoomTo = function(textloc) {
        console.log(textloc);
        $http.get("http://nominatim.openstreetmap.org/search?format=json&limit=5&q=" + textloc).success(function(data) {
            if (!data[0]) {
                scope.validLocation = "";
            } else {
                scope.validLocation = data[0].display_name;
                map.panTo([ data[0].lat, data[0].lon ]);
            }
        }).error(function(data) {
            scope.validLocation = "";
        });
    };
    scope.chatRoom = null;
    scope.loadChatRoom = function(name) {
        scope.chatRoom = name;
    };
    scope.chatRooms = {
        pizzachat: {
            title: "Pizza Chat",
            users: [ "a@a.com", "b@b.com", "c@c.com" ]
        }
    };
    window.angularScope = scope;
    var client;
    client = new Faye.Client("/faye");
    client.subscribe("/message/test", function(payload) {
        var time;
        time = moment(payload.created_at).format("D/M/YYYY H:mm:ss");
        return $("#chat").append("<li>" + time + " : " + payload.message + "</li>");
    });
    $(document).ready(function() {
        var button, input;
        input = $("input");
        button = $("button");
        return button.click(function() {
            var publication;
            button.attr("disabled", "disabled");
            button.text("Posting...");
            publication = client.publish("/message/test", {
                message: input.val(),
                created_at: new Date()
            });
            publication.callback(function() {
                input.val("");
                button.removeAttr("disabled");
                return button.text("Post");
            });
            return publication.errback(function() {
                button.removeAttr("disabled");
                return button.text("Try again");
            });
        });
    });
    window.client = client;
}).directive("appMarkdown", function() {
    var converter = new Showdown.converter();
    return {
        restrict: "AE",
        link: function(scope, element, attrs) {
            element.html(converter.makeHtml(element.text()));
        }
    };
});