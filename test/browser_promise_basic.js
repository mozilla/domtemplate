/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that our Promise implementation works properly

/*
 * These tests run both in Mozilla/Mochitest and plain browsers (as does
 * domtemplate)
 * We should endeavor to keep the source in sync. Ask author for details
 *
 * Author: Joe Walker <jwalker@mozilla.com>
 */

var imports = {};
Cu.import("resource:///modules/devtools/Promise.jsm", imports);

function test() {
  addTab("about:blank", function() {
    info("Starting Promise Tests");
    testBasic();
  });
}

var postResolution;

function testBasic() {
  postResolution = new imports.Promise();
  ok(postResolution.isPromise, "We have a promise");
  ok(!postResolution.isComplete(), "Promise is initially incomplete");
  ok(!postResolution.isResolved(), "Promise is initially unresolved");
  ok(!postResolution.isRejected(), "Promise is initially unrejected");

  // Test resolve() *after* then() in the same context
  var reply = postResolution.then(testPostResolution, fail)
                            .resolve("postResolution");
  is(reply, postResolution, "return this; working ok");
}

var preResolution;

function testPostResolution(data) {
  is(data, "postResolution", "data is postResolution");
  ok(postResolution.isComplete(), "postResolution Promise is complete");
  ok(postResolution.isResolved(), "postResolution Promise is resolved");
  ok(!postResolution.isRejected(), "postResolution Promise is unrejected");

  try {
    info("Expecting double resolve error");
    postResolution.resolve("double resolve");
    ok(false, "double resolve");
  }
  catch (ex) {
    info("Got double resolve error");
  }

  // Test resolve() *before* then() in the same context
  preResolution = new imports.Promise();
  var reply = preResolution.resolve("preResolution")
                           .then(testPreResolution, fail);
  is(reply, preResolution, "return this; working ok");
}

var laterResolution;

function testPreResolution(data) {
  is(data, "preResolution", "data is preResolution");
  ok(preResolution.isComplete(), "preResolution Promise is complete");
  ok(preResolution.isResolved(), "preResolution Promise is resolved");
  ok(!preResolution.isRejected(), "preResolution Promise is unrejected");

  // Test resolve() *after* then() in a later context
  laterResolution = new imports.Promise();
  laterResolution.then(testLaterResolution, fail);
  executeSoon(function() {
    laterResolution.resolve("laterResolution");
  });
}

var laterRejection;

function testLaterResolution(data) {
  is(data, "laterResolution", "data is laterResolution");
  ok(laterResolution.isComplete(), "laterResolution Promise is complete");
  ok(laterResolution.isResolved(), "laterResolution Promise is resolved");
  ok(!laterResolution.isRejected(), "laterResolution Promise is unrejected");

  // Test reject() *after* then() in a later context
  laterRejection = new imports.Promise().then(fail, testLaterRejection);
  executeSoon(function() {
    laterRejection.reject("laterRejection");
  });
}

function testLaterRejection(data) {
  is(data, "laterRejection", "data is laterRejection");
  ok(laterRejection.isComplete(), "laterRejection Promise is complete");
  ok(!laterRejection.isResolved(), "laterRejection Promise is unresolved");
  ok(laterRejection.isRejected(), "laterRejection Promise is rejected");

  // Test chaining
  var orig = new imports.Promise();
  orig.chainPromise(function(data) {
    is(data, "origData", "data is origData");
    return data.replace(/orig/, "new");
  }).then(function(data) {
    is(data, "newData", "data is newData");
    testChain();
  });
  orig.resolve("origData");
}

var member1;
var member2;
var member3;
var laterGroup;

function testChain() {
  // Test an empty group
  var empty1 = imports.Promise.group();
  ok(!empty1.isRejected(), "empty1 Promise is unrejected");

  // Test a group with no members
  var empty2 = imports.Promise.group([]);
  ok(!empty2.isRejected(), "empty2 Promise is unrejected");

  // Test grouping using resolve() in a later context
  member1 = new imports.Promise();
  member2 = new imports.Promise();
  member3 = new imports.Promise();
  laterGroup = imports.Promise.group(member1, member2, member3);
  laterGroup.then(testLaterGroup, fail);

  member1.then(function(data) {
    is(data, "member1", "member1 is member1");
    executeSoon(function() {
      member2.resolve("member2");
    });
  }, fail);
  member2.then(function(data) {
    is(data, "member2", "member2 is member2");
    executeSoon(function() {
      member3.resolve("member3");
    });
  }, fail);
  member3.then(function(data) {
    is(data, "member3", "member3 is member3");
    // The group should now fire
  }, fail);
  executeSoon(function() {
    member1.resolve("member1");
  });
}

var tidyGroup;

function testLaterGroup(data) {
  is(data[0], "member1", "member1 is member1");
  is(data[1], "member2", "member2 is member2");
  is(data[2], "member3", "member3 is member3");
  is(data.length, 3, "data.length is right");
  ok(laterGroup.isComplete(), "laterGroup Promise is complete");
  ok(laterGroup.isResolved(), "laterGroup Promise is resolved");
  ok(!laterGroup.isRejected(), "laterGroup Promise is unrejected");

  // Test grouping resolve() *before* then() in the same context
  tidyGroup = imports.Promise.group([
    postResolution, preResolution, laterResolution,
    member1, member2, member3, laterGroup
  ]);
  tidyGroup.then(testTidyGroup, fail);
}

var failGroup;

function testTidyGroup(data) {
  is(data[0], "postResolution", "postResolution is postResolution");
  is(data[1], "preResolution", "preResolution is preResolution");
  is(data[2], "laterResolution", "laterResolution is laterResolution");
  is(data[3], "member1", "member1 is member1");
  is(data[6][1], "member2", "laterGroup is laterGroup");
  is(data.length, 7, "data.length is right");
  ok(tidyGroup.isComplete(), "tidyGroup Promise is complete");
  ok(tidyGroup.isResolved(), "tidyGroup Promise is resolved");
  ok(!tidyGroup.isRejected(), "tidyGroup Promise is unrejected");

  // Test grouping resolve() *before* then() in the same context
  failGroup = imports.Promise.group(postResolution, laterRejection);
  failGroup.then(fail, testFailGroup);
}

function testFailGroup(data) {
  is(data, "laterRejection", "laterRejection is laterRejection");

  postResolution = undefined;
  preResolution = undefined;
  laterResolution = undefined;
  member1 = undefined;
  member2 = undefined;
  member3 = undefined;
  laterGroup = undefined;
  laterRejection = undefined;

  testTrap();
}

function testTrap() {
  var p = new imports.Promise();
  var message = "Expected exception";
  p.chainPromise(
    function() {
      throw new Error(message);
    }).trap(
      function(aError) {
        is(aError instanceof Error, true, "trap received exception");
        is(aError.message, message, "trap received correct exception");
        return 1;
      }).chainPromise(
        function(aResult) {
          is(aResult, 1, "trap restored correct result");
          testAlways();
        });
  p.resolve();
}

function testAlways() {
  var shouldbeTrue1 = false;
  var shouldbeTrue2 = false;
  var p = new imports.Promise();
  p.chainPromise(
    function() {
      throw new Error();
    }
  ).chainPromise(//Promise rejected, should not be executed
    function() {
      ok(false, "This should not be executed");
    }
  ).always(
    function(x) {
      shouldbeTrue1 = true;
      return "random value";
    }
  ).trap(
    function(arg) {
      ok((arg instanceof Error), "The random value should be ignored");
      return 1;//We should still have this result later
    }
  ).trap(
    function() {
      ok(false, "This should not be executed 2");
    }
  ).always(
    function() {
      shouldbeTrue2 = true;
    }
  ).then(
    function(aResult){
      ok(shouldbeTrue1, "First always must be executed");
      ok(shouldbeTrue2, "Second always must be executed");
      is(aResult, 1, "Result should be unaffected by always");

      finished();
    }
  );
  p.resolve();
}

function fail() {
  imports = undefined;
  gBrowser.removeCurrentTab();
  info("Failed Promise Tests");
  ok(false, "fail called");
  finish();
}

function finished() {
  imports = undefined;
  gBrowser.removeCurrentTab();
  info("Finishing Promise Tests");
  finish();
}
