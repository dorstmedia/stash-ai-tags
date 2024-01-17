// ==UserScript==
// @name        stash-ai-runner
// @description Find tags for a scene
// @icon        https://raw.githubusercontent.com/dorstmedia/stash-ai-tags/main/_media/tag_logo.png
// @namespace   https://github.com/dorstmedia
// @version     0.1
// @homepage    https://github.com/dorstmedia/stash-ai-tags
// @author      dorstmedia (forked from cc12344567)
// @match       http://localhost:9999/*
// @connect     localhost
// @run-at      document-idle
// @require     https://raw.githubusercontent.com/7dJx1qP/stash-userscripts/master/src/StashUserscriptLibrary.js
// @downloadURL https://raw.githubusercontent.com/dorstmedia/stash-ai-tags/main/dist/stash-ai-runner.user.js
// @updateURL   https://raw.githubusercontent.com/dorstmedia/stash-ai-tags/main/dist/stash-ai-runner.user.js
// @grant       GM_getResourceText
// @grant       GM_xmlhttpRequest
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const { stash: stash$1 } = unsafeWindow.stash;

    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function waitForElm(selector) {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver((mutations) => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        });
    }

    function waitForElmHide(selector) {
        return new Promise(resolve => {
            if (!document.querySelector(selector)) {
                return resolve(selector);
            }

            const observer = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    resolve(selector);
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                subtree: true,
                childList: true,
            });
        });
    }

      /**
   * Retrieves all tags from the server and returns them as a map with tag names (and aliases) as keys and tag IDs as values.
   * @returns {Promise<Object>} A promise that resolves to an object with tag names (and aliases) as keys and tag IDs as values.
   */
  async function getAllTags() {
    const reqData = {
      query: `{
      allTags{
        id
        name
        aliases
      }
    }`,
    };
    var result = await stash$1.callGQL(reqData);
    return result.data.allTags.reduce((map, obj) => {
      map[obj.name.toLowerCase()] = obj.id;
      obj.aliases.forEach((alias) => {
        map[alias.toLowerCase()] = obj.id;
      });
      return map;
    }, {});
  }

   /**
   * Updates a scene with the given scene_id and tag_ids.
   * @param {string} scene_id - The ID of the scene to update.
   * @param {Array<string>} tag_ids - An array of tag IDs to associate with the scene.
   * @returns {Promise<Object>} - A promise that resolves with the updated scene object.
   */
  async function updateScene(scene_id, tag_ids) {
    const reqData = {
      variables: { input: { id: scene_id, tag_ids: tag_ids } },
      query: `mutation sceneUpdate($input: SceneUpdateInput!){
      sceneUpdate(input: $input) {
        id
      }
    }`,
    };
    return stash$1.callGQL(reqData);
  }

   /**
   * Retrieves the URL of the sprite for a given scene ID.
   * @param {number} scene_id - The ID of the scene to retrieve the sprite URL for.
   * @returns {Promise<string|null>} - A Promise that resolves with the sprite URL if it exists, or null if it does not.
   */
  async function getUrlSprite(scene_id) {
    const reqData = {
      query: `{
      findScene(id: ${scene_id}){
        paths{
          sprite
        }
      }
    }`,
    };
    var result = await stash$1.callGQL(reqData);
    const url = result.data.findScene.paths["sprite"];
    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    } else {
      return result.data.findScene.paths["sprite"];
    }
  }

      /**
   * Returns an array with the scenario and scenario ID parsed from the current URL.
   * @returns {Array<string>} An array with the scenario and scenario ID.
   */
    function getScenarioAndID() {
        var result = document.URL.match(/(scenes|images)\/(\d+)/);
        var scenario = result[1];
        var scenario_id = result[2];
        return [scenario, scenario_id];
    }

    /**
   * Retrieves the tags associated with a given scene ID.
   *
   * @param {string} scene_id - The ID of the scene to retrieve tags for.
   * @returns {Promise<string[]>} - A promise that resolves with an array of tag IDs.
   */
    async function getTagsForScene(scene_id) {
        const reqData = {
            query: `{
      findScene(id: "${scene_id}") {
        tags {
          id
        }
      }
    }`,
        };
        var result = await stash$1.callGQL(reqData);
        return result.data.findScene.tags.map((p) => p.id);
    }

    function changeTagsThreshold(threshold) {
  		localStorage.setItem("stash-tag-threshold", threshold);
  	}
    function changeMarkersThreshold(threshold) {
  		localStorage.setItem("stash-marker-threshold", threshold);
  	}


    async function ai_get(btnId,btnAcceptId,waitBefore,waitAfter,timeout) {
        console.log('Run: Get Tags/Markers');
        console.log('Wait Before: '+waitBefore+'ms');
        await sleep(waitBefore);

        // Get the button with id "stashtag" and click on it
        console.log('Wait for Tag/Marker Button to appear');
        var aitagButton = await waitForElm('#'+btnId);
        await sleep(100);



        //Only run tagger if scrubber images wre generated
        //if(document.getElementsByClassName("scrubber-item").length > 0){

            aitagButton.addEventListener('click', function(event) {
                event.preventDefault();
                console.log('Button '+btnId+' clicked');
            });
            aitagButton.click();

            console.log('Wait for Accept Button to appear');
            var aitagAcceptButton = await waitForElm('#'+btnAcceptId);
            // Capture click event and prevent page reload
            aitagAcceptButton.addEventListener('click', function(event) {
                event.preventDefault();
                console.log('Button '+btnAcceptId+' clicked');
            });
            await sleep(1000);
            aitagAcceptButton.click();

            console.log('Wait for Accept Button to disappear');
            await waitForElmHide('#'+btnAcceptId);

        

        console.log('Wait After: '+waitAfter+'ms');
        await sleep(waitAfter);

    }
    async function ai_tag_runner_start(tagsThreshold,markersThreshold) {
        //await sleep(3000);
        console.log("ai_tag_runner_start");
        // Get all elements with the "preview-scrubber" class
        changeTagsThreshold(tagsThreshold);
        changeMarkersThreshold(markersThreshold);

        var previewElements = document.querySelectorAll('.preview-scrubber');

        if(previewElements.length > 0){

            let tags = await getAllTags();
            if (typeof tags["stash_ai_tags"] == 'undefined' || tags["stash_ai_tags"] === undefined) tags["stash_ai_tags"] = await createTag("STASH_AI_TAGS");
            if (typeof tags["stash_ai_markers"] == 'undefined' || tags["stash_ai_markers"] === undefined) tags["stash_ai_markers"] = await createTag("STASH_AI_MARKERS");
            if (typeof tags["stash_missing_sprites"] == 'undefined' || tags["stash_missing_sprites"] === undefined) tags["stash_missing_sprites"] = await createTag("STASH_MISSING_SPRITES");

            //console.log("AllTags",tags);
            // Iterate over each element and perform actions
            for (let i = 0; i < previewElements.length; i++) {
                console.log('another loop');
                console.log("Wait before opening Scene");
                await sleep(1000);
                // Click on the element
                previewElements[i].click();

                //Wait for Scene Page to load
                var scrubberWrapper = await waitForElm('.scrubber-wrapper');
                await sleep(500);
                //if(document.getElementsByClassName("scrubber-item").length > 0){
                let [,scene_id] = getScenarioAndID();
                let existingTags = await getTagsForScene(scene_id);
                //console.log("existingTags",existingTags);
                let sprites = await getUrlSprite(scene_id);

                if (!sprites) {
                    console.log("No sprite found, please ensure you have sprites enabled and generated for your scenes.");
                    if (typeof tags == 'undefined'){
                        let tags = await getAllTags();
                    }
                    if (typeof tags["stash_missing_sprites"] == 'undefined') tags["stash_missing_sprites"] = await createTag("STASH_MISSING_SPRITES");
                    let existingTags = await getTagsForScene(scene_id);
                    if (typeof tags["stash_missing_sprites"] != 'undefined' && !existingTags.includes(tags["stash_missing_sprites"])) existingTags.push(tags["stash_missing_sprites"]);
                    await updateScene(scene_id, existingTags);
                    await sleep(500);
                }else{
                    //Run AI tagger
                    if (!existingTags.includes(tags["stash_ai_tags"])) await ai_get("stashtag",'tags-accept',200,200,100);
                    //Run AI marker
                    if (!existingTags.includes(tags["stash_ai_markers"])) await ai_get("stashmarker",'markers-accept',200,200,100);
                }
                console.log('sleep ended')
                // Navigate back in browsing history
                console.log('lets go back');
                window.history.back();
                // Refresh the list of items after going back
                console.log('Wait for scenes overview to load');

                await waitForElmHide('.scrubber-wrapper');
                console.log('Refresh the list of items after going back');
                await waitForElm('.preview-scrubber');
                await sleep(500);
                previewElements = document.querySelectorAll('.preview-scrubber');
                if(previewElements.length < 1) window.location.hash='';
                window.location.reload();
            }
        }
    }
    function AiTagsBtn(btnId){
        //// Call the main function
        //var donate_btn = document.querySelector(".navbar-buttons.navbar-nav a.nav-utility");
        var btn_html='<button id="'+btnId+'" class="btn btn-primary btn-sm">AI Run</button>';
        var btn_parent=document.querySelector(".navbar-buttons.navbar-nav");
        if(!btn_parent){
            btn_parent=document.querySelector(".navbar-buttons .mr-2");
            if(!btn_parent){
                btn_parent=document.querySelector(".navbar .navbar-nav");
                if(!btn_parent) return false;
            }
        }
        //var tagRunnerBtn=document.getElementById(btnId);
        //if(!tagRunnerBtn || tagRunnerBtn.length == 0) {
        try{
            btn_parent.insertAdjacentHTML("afterbegin",btn_html);
        }catch(e){
            try{
                btn_parent.insertAdjacentHTML("beforebegin",btn_html);
            }catch(e){
                console.log("Failed to create AI Tag Button");
            }
        }
        //}
        /*
	//document.querySelector(".navbar-buttons.navbar-nav").insertAdjacentHTML( 'afterbegin', '<a id="ai_tag_runner" href="#"><button type="button" class="btn btn-primary btn-sm" id="ai_tag_runner">AI Tags</button></a>' );

	//var first_a_in_nav = document.querySelector(".navbar-buttons.navbar-nav > a")[0];
	//first_a_in_nav.insertAdjacentHTML("beforebegin",'<a id="ai_tag_runner" class="btn btn-primary btn-sm" id="ai_tag_runner" href="#">AI Tags</a>');


	//document.querySelectorAll(".navbar-buttons.navbar-nav")[0];

	//document.querySelector(".navbar-buttons.navbar-nav a.nav-utility").href="#";
	//var donate_btn = document.querySelector(".navbar-buttons.navbar-nav a.nav-utility");
	//donate_btn.innerHTML='<button type="button" class="btn btn-primary btn-sm" id="ai_tag_runner">AI Tags</button>';
	//donate_btn.onclick=ai_tag_runner_start;
	//document.querySelector(".navbar-buttons.navbar-nav .btn").classList.add("btn-sm");
	*/
    }
    /*
// Function to wait for the page to finish loading
async function waitForPageLoad() {
    return new Promise(resolve => {
        window.addEventListener('load', resolve);
    });
}
*/

  const { stash } = unsafeWindow.stash;
  stash.addEventListener("page:scenes", function () {
      waitForElm(".preview-scrubber").then(() => {
          if (!document.getElementById("ai_tag_runner")) {
              AiTagsBtn("ai_tag_runner");
              if(document.getElementById("ai_tag_runner")){
                  console.log("window.location.hash",window.location.hash);
                  if(window.location.hash=='#ai_runner'){
                      ai_tag_runner_start(0.75,0.75);
                  }
                  document.getElementById("ai_tag_runner").addEventListener("click", (event) => {
                      event.preventDefault();
                      window.location.hash='ai_runner';
                      ai_tag_runner_start(0.75,0.75);
                  });
              };
          }
      });
  });


})();
