/// <reference path="bosstimer.d.ts" />

//Enable "Add App" button for Alt1 Browser.
A1lib.identifyApp("appconfig.json");

let isPaused = true;
let isAttackable = false;
let recalButtonVisible = false;
let tooltipEnabled = true;
let autoStopEnabled = false;
let imgFound = false;
let crystalMaskActive = false;
let startDate = Date.now();
let shroomStartDate = Date.now();
let attackStartDate = Date.now();
let currentTooltip = "";
let lastUpcomingMessage = "";

let attackOffset = 0;
let recalOffset = 0;
let intervalCount = 0;
let cMaskCount = 0;
let attackEndCount = 0;

let midOffset = 14;
let startOffset = 0;
let crystalMaskSetting = 0;

let attacks = {
  15: ["Red bomb", "Move"],
  27: ["Fairy ring", "Move"],
  39: ["Slimes", "Evade"],
  51: ["Yellow bomb", "Move"],
  63: ["Stun", "Use anticipation"],
  72: ["Sticky fungi", "Click feet"],
  87: ["Green bomb", "Move"],
  99: ["Fairy ring", "Move"],
  111: ["Slimes", "Evade"],
  123: ["Blue bomb", "Move"],
  135: ["Stun", "Use anticipation"],
  144: ["Mid energy fungi", "Go to mid"],
}

let alertSound = new Audio("./assets/shatter.mp3");

// Set Chat reader
let chatReader = new Chatbox.default();
chatReader.readargs = {
  colors: [
    A1lib.mixColor(255, 255, 255),
    A1lib.mixColor(128, 69, 182),
  ],
  backwards: true,
};

let bossTimerReader = new BossTimer.default();

let buffReader = new BuffsReader.default();

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// Buff reader interval
let buffReadInterval = null;

// Boss timer interval
let bossTimer = setInterval(function () {
  updateClock();
}, 300);

chatReader.find();
chatReader.read();

buffReader.find();

// Chat finder & parser functions adapted from: https://github.com/ZeroGwafa/SerenTracker
let findChat = setInterval(function () {
  if (chatReader.pos === null) {
    chatReader.find();
  }
  else {
    clearInterval(findChat);
    chatReader.pos.boxes.map((box, i) => {
      $(".chat").append(`<option value=${i}>Chat ${i}</option>`);
    });

    if (localStorage.susChat) {
      $(".chat").val(localStorage.susChat);
      chatReader.pos.mainbox = chatReader.pos.boxes[localStorage.susChat];
    } 
    else {
      //If multiple boxes are found, this will select the first, which should be the top-most chat box on the screen.
      chatReader.pos.mainbox = chatReader.pos.boxes[0];
    }
    
    showSelectedChat(chatReader.pos);
    setInterval(function () {
      if (intervalCount % 2) {
        readBossTimer();
      }
      else {
        readChatbox();
      }

      intervalCount = intervalCount + 1;
    }, 165);
  }
}, 1000);

function showSelectedChat(chat) {
  //Attempt to show a temporary rectangle around the chatbox.  skip if overlay is not enabled.
  try {
    alt1.overLayRect(
      A1lib.mixColor(255, 255, 255),
      chat.mainbox.rect.x,
      chat.mainbox.rect.y,
      chat.mainbox.rect.width,
      chat.mainbox.rect.height,
      2000,
      3
    );
  } catch { }
}

// Reading and parsing info from the chatbox.
function readChatbox() {
  var opts = chatReader.read() || [];
  var chat = "";

  for (a in opts) {
    chat += opts[a].text + " ";
  }
  
  // Check for lines indicating the core can be attacked.
  if (!isPaused && !isAttackable && (chat.indexOf("is vulnerable. Attack its core!") > -1 || 
                                     chat.indexOf("dark feast subsides. Strike now!") > -1 || 
                                     chat.indexOf("is the time. To the core!") > -1)) {
    console.log("Attack detected");
    startAttack();
  }
  
  // Check for lines indicating the attack phase has ended
  if (!isPaused  && isAttackable && (chat.indexOf("feeds again - stand ready!") > -1 || 
                                     chat.indexOf("out - it is awakening.") > -1 ||
                                     chat.indexOf("is going to wake any moment.") > -1)) { // Might not be correct?
    console.log("End of attack detected");
    endAttack();
  }
  
  // Check for lines indicating the mid energy fungi have spawned
  //if (!isPaused && !isAttackable && (chat.indexOf("the fungus at Croesus's base!") > -1 ||
  //                                   chat.indexOf("fungus at Croesus's base - destroy it, now!") > -1)) { 
  //  console.log("Mid detected");
  //}
}

function readBossTimer() {
  if (isPaused && bossTimerReader.find() != null){
    attackEndCount = 0;
    startEncounter(startOffset);
  }
  else if (!isPaused && bossTimerReader.find() == null) {
    if(attackEndCount >= 3){
      attackEndCount = 0;
      stopEncounter();
    }

    attackEndCount = attackEndCount + 1;
  }
}

// Calculates an offset to recalibrate the  timer
function calculateRecalOffset(){
  let time = Date.now() - startDate;
  let adjTime = new Date(time < 0 ? 0 : time).getTime()/1000;
  
  adjTime = adjTime - attackOffset;
  
  let totalTime = 147 + midOffset;
  
  adjTime = adjTime % totalTime;
  
  if (adjTime >= 148) {
    recalOffset = adjTime - totalTime;
  }
  else if (adjTime <= 25) {
    recalOffset = adjTime;
  }

  console.log("Mid down, recalOffset: " + recalOffset);

  recalButtonVisible = false;
  elid("recalButton").classList.add("d-none");
}

// Updates clock, upcoming/incoming attack messages and the tooltip (Needs to be broken up)
function updateClock() {
  if (!isPaused) {
    let upcomingAttack = 0;
    let incomingAttack = 0;
    let attackTime = 0;
    let oldAdjTime = 0;
    let time = Date.now() - startDate;
    let adjTime = new Date(time < 0 ? 0 : time).getTime()/1000;
    message(adjTime.toFixed(0) + "s", "timerBox");
    
    adjTime = adjTime - attackOffset - recalOffset;
    
    // Check if fight is at least at or past first mid
    if (adjTime >= 143 + midOffset) {
      let totalTime = 147 + midOffset;
      oldAdjTime = adjTime;
      
      adjTime = adjTime % totalTime;
      
      if(adjTime < 0){
        adjTime = oldAdjTime - recalOffset;
      }
    }
    
    let count = 0;
    
    if (!isAttackable) {
      for (var key in attacks) {
        // Check if this is an incoming attack
        if ((parseInt(key) - 4) < adjTime && adjTime < (parseInt(key) + 9)) {
          // Check if this is the last attack (Mid energy fungi)
          if (count == (Object.keys(attacks).length - 1)) {
            if (adjTime < (parseInt(key) + 7)) {
              incomingAttack = key;
              attackTime = parseInt(key);
                
              message("Upcoming attack: Red bomb", "upcomingBox");
            } 
            else if (!recalButtonVisible && ((parseInt(key) + 7) <= adjTime && adjTime < (parseInt(key) + 9))) {
              recalButtonVisible = true;
              elid("recalButton").classList.remove("d-none");
            }
          }
          // This is different attack
          else if (adjTime < (parseInt(key) + 3)) {
            incomingAttack = key;
            attackTime = parseInt(key);
            
            if (recalButtonVisible) {
              recalButtonVisible = false;
              elid("recalButton").classList.add("d-none");
            }

            upcomingAttack = parseInt(count) + 1;

            break;
          }
        }

        count = count + 1;
      }

      let timeLeft = (attackTime - adjTime).toFixed(0);  
  
      updateAttacksUI(incomingAttack, upcomingAttack, timeLeft);
    }
  }
}

function checkBuffBar(imgSrc) {
  if(buffReader.pos === null){
    buffReader.find();
  }
  else {
    let buffReadout = buffReader.read();
    const image = new Image;
    image.src = imgSrc;
    image.onload = () => {
      ctx.drawImage(image, 0, 0);
      imageData = ctx.getImageData(0, 0, 25, 25);
      
      for (var buffObj in buffReadout) {
        let countMatch = buffReadout[buffObj].countMatch(imageData,false).passed;
  
        if(countMatch >= 70){
          imgFound = true;
        }
      }
    }
  }
}

function readBuffBar() {
  if(crystalMaskSetting != 0){
    checkBuffBar("./assets/crystalmask.png");
  
    if (imgFound && !crystalMaskActive) {
      crystalMaskActive = true;
      cMaskCount = 0;
  
      elid("body").classList.add("green-border");
      elid("body").classList.remove("red-border");
    }
    else if (crystalMaskActive && !imgFound) {
      if (cMaskCount > 1){
        crystalMaskActive = false;
        cMaskCount = 0;

        elid("body").classList.remove("green-border");
        elid("body").classList.add("red-border");
  
        if(crystalMaskSetting === 2){
          alertSound.play();
          //alt1.overLayTextEx("Crystalmask has shattered!", A1lib.mixColor(0, 255, 0), 25,parseInt(alt1.rsWidth/2),parseInt((alt1.rsHeight/2)-300),3000,"monospace",true,true);
        }
      }
      
      cMaskCount = cMaskCount + 1;
    }
  
    imgFound = false;
  }
}

function updateAttacksUI(incomingAttack, upcomingAttack, timeLeft) {
  if (incomingAttack != 0) {
    if (timeLeft <= 0) {
      message("Incoming attack: \n" + attacks[incomingAttack][0]);
    }
    else {
      message("Incoming attack in " + timeLeft + ": \n" + attacks[incomingAttack][0]);
    }
  }
  else if (incomingAttack == 0 && currentTooltip != "") {
    alt1.clearTooltip();
    currentTooltip = "";
    message("");
  }
  
  if(incomingAttack != 0 && currentTooltip == "") {
    currentTooltip = attacks[incomingAttack][0] + ": " + attacks[incomingAttack][1];
    if (tooltipEnabled) {
      updateTooltip();
    }
  }

  if (upcomingAttack != 0) {
    let keys = Object.keys(attacks);
    message("Upcoming attack: " + attacks[keys[upcomingAttack]][0], "upcomingBox");
  }
}

// Update the text in the tooltip
function updateTooltip(){
  if(currentTooltip!=""){
    if(!alt1.setTooltip(" " + currentTooltip)){
      currentTooltip="";
      console.log("No tooltip permission");}}
  else {
    alt1.clearTooltip();
    currentTooltip="";
  }
}

function startEncounter(offset = 0) {
  isPaused = false;
  attackEndCount = 0;
  startDate = Date.now() + offset;
  
  message("Encounter started!");
  message("Upcoming attack: Red bomb","upcomingBox");
  
  elid("startButton").innerHTML = "Stop";
}

function stopEncounter() {
  isPaused = true;
  isAttackable = false;
  recalButtonVisible = false;
  currentTooltip = "";
  lastUpcomingMessage = "";
  attackOffset = 0;
  recalOffset = 0;
  intervalCount = 0;
  cMaskCount = 0;
  imgFound = 0;


  elid("recalButton").classList.add("d-none");
  
  elid("startButton").innerHTML = "Start";
  alt1.clearTooltip();
  message("Encounter stopped!");
  message("","upcomingBox");
}

function startAttack() {
  isAttackable = true;
  
  lastUpcomingMessage = document.getElementById('upcomingBox').textContent;

  elid("recalButton").classList.add("d-none");
    
  message("","upcomingBox");
  message("Croesus is vulnerable,\nattack the core!");
  
  updateTooltip("Attack the core!");
  
  attackStartDate = Date.now();
}

function endAttack() {
  isAttackable = false;
    
  message(lastUpcomingMessage,"upcomingBox");
  message("");
  alt1.clearTooltip();
  
  attackOffset = attackOffset + (Date.now() - attackStartDate) / 1000;
  console.log("Attack ended, time offset: " + attackOffset);
}

function updateShroomTimer() {
  shroomStartDate = Date.now() - 400;
  elid("shroomImage").classList.remove("d-none");
  message("29s","shroomTimer");
  
  setInterval(function() { 
    let time = Date.now() - shroomStartDate;

    let adjTime = new Date(time < 0 ? 0 : time).getTime()/1000;

    adjTime = adjTime % 30;
    adjTime = Math.abs(29 - adjTime).toFixed(0);

    if(adjTime < 0){
      adjTime = 0;
    }

    message(adjTime + "s","shroomTimer");
  }, 1000);
}

function nudgeTimer(time) {
  startDate = new Date(startDate).getTime() + time;
  
  updateClock();
}

function message(str,elementId="incomingBox"){
  elid(elementId).innerHTML=str;
}

// Gets called when user presses the alt + 1 keybind.
function alt1onrightclick(obj) {
  calculateRecalOffset();
}

$('document').ready(function(){
  alertSound.volume = 0.3;

  // Settings
  $(".chat").change(function () {
    chatReader.pos.mainbox = chatReader.pos.boxes[$(this).val()];
    showSelectedChat(chatReader.pos);
    localStorage.setItem("susChat", $(this).val());
  });

  $(".cMask").change(function () {
    crystalMaskSetting = parseInt($(this).val());
    localStorage.setItem("susCMask", $(this).val());

    if (crystalMaskSetting == 0) {
      clearInterval(buffReadInterval);
      buffReadInterval = null;
      crystalMaskActive = false;

      elid("body").classList.remove("green-border");
      elid("body").classList.remove("red-border");
    }
    else if(buffReadInterval === null) {
      buffReadInterval = setInterval(function () {
        readBuffBar();
      }, 600);
    }
  });

  $("#tooltipCheck").change(function () {
    updateTooltip("");
    alt1.clearTooltip();
    
    tooltipEnabled = $(this).prop("checked");
    localStorage.setItem("susTooltip", tooltipEnabled);
  });

  $("#startDelayInput").change(function () {
    startOffset = parseInt($(this).val());
    localStorage.setItem("susStartDelay", startOffset);
  });

  $("#midDelayInput").change(function () {
    midOffset = parseInt($(this).val());
    localStorage.setItem("susMidDelay", midOffset);
  });

  // UI Buttons
  $("#shroomSyncButton").click(function () {
    updateShroomTimer();
  });

  $("#recalButton").click(function () {
    calculateRecalOffset();
  });

  $("#plusButton").click(function () {
    nudgeTimer(-1000);
  });

  $("#minusButton").click(function () {
    nudgeTimer(1000);
  });

  $("#startButton").click(function () {
    if(isPaused){
      startEncounter();
    }
    else {
      stopEncounter();
    }
  });

  startDelayInput = document.getElementsByName('startDelayInput');
  delayInput = document.getElementsByName('midDelayInput');
  ttCheck = document.getElementById('tooltipCheck');  

  // Check for saved start delay & set it
  if (localStorage.susStartDelay) {
    startOffset = parseInt(localStorage.susStartDelay);
    
    startDelayInput[0].value = startOffset;
  }
  else {
    startDelayInput[0].value = startOffset;
  }
  
  // Check for saved delay & set it
  if (localStorage.susMidDelay) {
    midOffset = parseInt(localStorage.susMidDelay);
    
    delayInput[0].value = midOffset;
  }
  else {
    delayInput[0].value = midOffset;
  }
    
  // Check for saved tooltipEnabled & set it
  if (localStorage.susTooltip) {
    tooltipEnabled = JSON.parse(localStorage.susTooltip);
    
    ttCheck.checked = tooltipEnabled;
  }
  else {
    ttCheck.checked = true;
  }

  // Check for saved crystalmask detection & set it
  if (localStorage.susCMask) {
    crystalMaskSetting = parseInt(localStorage.susCMask);
    $(".cMask").val(crystalMaskSetting);

    buffReadInterval = setInterval(function () {
      readBuffBar();
    }, 500);
  }
});