// ==UserScript==
// @name        stash-ai-runner
// @description Find tags for a scene
// @icon        https://raw.githubusercontent.com/dorstmedia/stash-ai-tags/main/_media/stashapp-favicon.ico
// @namespace   https://github.com/dorstmedia/stash-ai-tags
// @version     0.1.1.4
// @homepage    https://github.com/dorstmedia/stash-ai-tags/blob/main/dist/stash-ai-runner.user.js
// @author      dorstmedia (forked from cc12344567)
// @match       http://localhost:9999/*
// @exclude     http://localhost:9999/settings?tab=logs
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


    async function ai_get(btnId,btnAcceptId,waitBefore,waitAfter,timeout,clicked=false) {
        console.log('Run: Get Tags/Markers');
        console.log('Wait Before: '+waitBefore+'ms');
        await sleep(waitBefore);

        if(!clicked){

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
        }
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
    async function ai_runner_start(ai_runner_type,tagsThreshold,markersThreshold) {
        var running_svg='<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="gear" class="svg-inline--fa fa-gear fa-spin " role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M481.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-30.9 28.1c-7.7 7.1-11.4 17.5-10.9 27.9c.1 2.9 .2 5.8 .2 8.8s-.1 5.9-.2 8.8c-.5 10.5 3.1 20.9 10.9 27.9l30.9 28.1c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-39.7-12.6c-10-3.2-20.8-1.1-29.7 4.6c-4.9 3.1-9.9 6.1-15.1 8.7c-9.3 4.8-16.5 13.2-18.8 23.4l-8.9 40.7c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-8.9-40.7c-2.2-10.2-9.5-18.6-18.8-23.4c-5.2-2.7-10.2-5.6-15.1-8.7c-8.8-5.7-19.7-7.8-29.7-4.6L69.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l30.9-28.1c7.7-7.1 11.4-17.5 10.9-27.9c-.1-2.9-.2-5.8-.2-8.8s.1-5.9 .2-8.8c.5-10.5-3.1-20.9-10.9-27.9L8.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l39.7 12.6c10 3.2 20.8 1.1 29.7-4.6c4.9-3.1 9.9-6.1 15.1-8.7c9.3-4.8 16.5-13.2 18.8-23.4l8.9-40.7c2-9.1 9-16.3 18.2-17.8C213.3 1.2 227.5 0 242 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l8.9 40.7c2.2 10.2 9.4 18.6 18.8 23.4c5.2 2.7 10.2 5.6 15.1 8.7c8.8 5.7 19.7 7.7 29.7 4.6l39.7-12.6c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM242 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"></path></svg>';
        document.getElementById("ai_tag_runner").innerHTML=running_svg+'&nbsp; Stop AI Run ['+ai_runner_type+']';
        document.getElementById("ai_tag_runner").title="Stop AI Runner";
        document.getElementById("ai_tag_runner").addEventListener("click", (event) => {
            event.preventDefault();
            window.location.hash='';
            document.getElementById("ai_tag_runner").innerHTML='AI Run';
            document.getElementById("ai_tag_runner").title="Start AI Runner";
            window.location.reload();
        });
        //await sleep(3000);
        console.log("ai_runner_start");
        // Get all elements with the "preview-scrubber" class
        changeTagsThreshold(tagsThreshold);
        changeMarkersThreshold(markersThreshold);

        var previewElements = document.querySelectorAll('.preview-scrubber');

        if(previewElements.length > 0){

            let tags = await getAllTags();
            if (typeof tags["stash_ai_tags"] == 'undefined' || tags["stash_ai_tags"] === undefined) tags["stash_ai_tags"] = await createTag("STASH_AI_TAGS");
            if (typeof tags["stash_ai_markers"] == 'undefined' || tags["stash_ai_markers"] === undefined) tags["stash_ai_markers"] = await createTag("STASH_AI_MARKERS");
            if (typeof tags["stash_missing_sprites"] == 'undefined' || tags["stash_missing_sprites"] === undefined) tags["stash_missing_sprites"] = await createTag("STASH_MISSING_SPRITES");
            if (typeof tags["stash_ai_tags_markers"] == 'undefined' || tags["stash_ai_tags_markers"] === undefined) tags["stash_ai_tags_markers"] = await createTag("STASH_AI_TAGS_MARKERS");


            //console.log("AllTags",tags);
            // Iterate over each element and perform actions
            let i = 0
            console.log('another loop');
            console.log("Wait before opening Scene");
            await sleep(100);
            // Click on the element
            previewElements[i].click();

            //Wait for Scene Page to load
            var scrubberWrapper = await waitForElm('.scrubber-wrapper');
            await sleep(100);
            //if(document.getElementsByClassName("scrubber-item").length > 0){
            let [,scene_id] = getScenarioAndID();
            
            //console.log("existingTags",existingTags);
            let sprites = await getUrlSprite(scene_id);

            await sleep(500);
            let existingTags = await getTagsForScene(scene_id);

            if (!sprites) {
                console.log("No sprite found, please ensure you have sprites enabled and generated for your scenes.");
                if (typeof tags["stash_missing_sprites"] != 'undefined' && !existingTags.includes(tags["stash_missing_sprites"])) existingTags.push(tags["stash_missing_sprites"]);
                await updateScene(scene_id, existingTags);
            }else{
                //Run AI tagger
                var clicked=false;

                if (ai_runner_type=="tags,markers" && !existingTags.includes(tags["stash_ai_tags"]) && !existingTags.includes(tags["stash_ai_markers"])){
                    if(document.getElementById("stashtag") && document.getElementById("stashmarker")){
                        document.getElementById("stashtag").click();
                        document.getElementById("stashmarker").click();
                        clicked=true;
                        await sleep(100);
                    }
                }
                if ((ai_runner_type=="tags,markers" || ai_runner_type=="tags") && document.getElementById("stashtag") && !existingTags.includes(tags["stash_ai_tags"])){
                    await ai_get("stashtag",'tags-accept',200,200,100,clicked);
                }

                //Run AI marker
                if ((ai_runner_type=="tags,markers" || ai_runner_type=="markers") && document.getElementById("stashmarker") && !existingTags.includes(tags["stash_ai_markers"])){
                    await ai_get("stashmarker",'markers-accept',200,200,100,clicked);
                }

                existingTags = await getTagsForScene(scene_id);
                if (typeof tags["stash_ai_tags_markers"] != 'undefined' && typeof tags["stash_ai_tags"] != 'undefined' && typeof tags["stash_ai_markers"] != 'undefined'){
                    if(!existingTags.includes(tags["stash_ai_tags_markers"]) && existingTags.includes(tags["stash_ai_tags"]) && !existingTags.includes(tags["stash_ai_markers"])){
                        existingTags.push(tags["stash_ai_tags_markers"]);
                        await updateScene(scene_id, existingTags);
                    }
                }
            }
            await sleep(200);
            console.log('sleep ended')
            // Navigate back in browsing history
            console.log('lets go back');
            window.history.back();
            // Refresh the list of items after going back
            console.log('Wait for scenes overview to load');

            await waitForElmHide('.scrubber-wrapper');
            console.log('Refresh the list of items after going back');
            await waitForElm('.preview-scrubber');
            await sleep(200);
            previewElements = document.querySelectorAll('.preview-scrubber');
            if(previewElements.length < 1) window.location.hash='';
            window.location.reload();
        }
        
    }
    function AiTagsBtn(btnId){
        //// Call the main function
        //var donate_btn = document.querySelector(".navbar-buttons.navbar-nav a.nav-utility");
        var btn_html='<button id="'+btnId+'" class="btn btn-primary btn-sm" title="Start AI Runner">AI Run</button>';
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
            btn_parent.insertAdjacentHTML("afterbegin",btn_html+"&nbsp;");
        }catch(e){
            try{
                btn_parent.insertAdjacentHTML("beforebegin",btn_html+"&nbsp;");
            }catch(e){
                console.log("Failed to create AI Tag Button");
            }
        }
    }

    const { stash } = unsafeWindow.stash;
    stash.addEventListener("page:scenes", function () {
        waitForElm(".preview-scrubber").then(() => {
            if (!document.getElementById("ai_tag_runner")) {
                AiTagsBtn("ai_tag_runner");
                if(document.getElementById("ai_tag_runner")){
                    console.log("window.location.hash",window.location.hash);
                    if(window.location.hash=='#ai_runner=tags,markers') ai_runner_start("tags,markers",0.75,0.75);
                    if(window.location.hash=='#ai_runner=tags') ai_runner_start("tags",0.75,0.75);
                    if(window.location.hash=='#ai_runner=markers') ai_runner_start("markers",0.75,0.75);

                    document.getElementById("ai_tag_runner").addEventListener("click", (event) => {
                        event.preventDefault();
                        window.location.hash='ai_runner=tags,markers';
                        //window.location.hash='ai_runner=tags';
                        //window.location.hash='ai_runner=markers';

                        window.location.reload();
                        //ai_runner_start(0.75,0.75);
                    });
                };
            }
        });
    });


})();
