/// <reference path="bosstimer.d.ts" />

//Enable "Add App" button for Alt1 Browser.
A1lib.identifyApp("appconfig.json");

let isPaused = true;
let isAttackable = false;
let recalButtonVisible = false;
let autoStopEnabled = false;
let crystalMaskActive = false;
let startDate = Date.now();
let attackStartDate = Date.now();
let currentTooltip = "";
let lastUpcomingMessage = "";

let attackOffset = 0;
let recalOffset = 0;
let intervalCount = 0;
let attackEndCount = 0;

let midOffset = 14;
let startOffset = 0;
let crystalMaskSetting = 0;
let tooltipSetting = 1;

// Array containing croesus' attacks, their timings and the counter move
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
  updateTimerUI();
}, 330);

// Try to find chatbox
try {
  chatReader.find();
  chatReader.read();
}
catch {
  console.log("Error: Could not find chatbox on initial load");
}

// Chat finder & parser functions adapted from: https://github.com/ZeroGwafa/SerenTracker
let findChat = setInterval(function () {
  if (chatReader.pos === null) {
    message("Looking for chatbox...");
    
    chatReader.find();
  }
  else {
    message("Ready!\nAwaiting boss start...");
    
    clearInterval(findChat);

    if (localStorage.susChat) {
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
  // Attempt to show a temporary rectangle around the chatbox. Skip if overlay is not enabled.
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
  
  if(!isPaused) {
    // Check for lines indicating the core can be attacked.
    if (!isAttackable && (chat.indexOf("is vulnerable. Attack its core!") > -1 || 
                          chat.indexOf("dark feast subsides. Strike now!") > -1 || 
                          chat.indexOf("is the time. To the core!") > -1)) {
      startAttack();
    }
    
    // Check for lines indicating the attack phase has ended
    if (isAttackable && (chat.indexOf("feeds again - stand ready!") > -1 || 
                         chat.indexOf("out - it is awakening.") > -1 ||
                         chat.indexOf("is going to wake any moment.") > -1)) { // Might not be correct?
      endAttack();
    }
  }
}

// Checks for boss timer on-screen and starts/stops the timer accordingly
function readBossTimer() {
  if (isPaused && bossTimerReader.find() != null) {
    attackEndCount = 0;
    startEncounter(startOffset);
  }
  else if (!isPaused && bossTimerReader.find() == null) {
    if (attackEndCount >= 3) {
      attackEndCount = 0;
      stopEncounter();
    }

    attackEndCount = attackEndCount + 1;
  }
}

// Calculates an offset to recalibrate the timer after mid
function calculateMidOffset() {
  let time = Date.now() - startDate;
  let adjTime = new Date(time < 0 ? 0 : time).getTime() / 1000;
  
  adjTime = adjTime - attackOffset;
  
  let totalTime = 147 + midOffset;
  
  adjTime = adjTime % totalTime;
  
  if (adjTime >= 148) {
    recalOffset = adjTime - totalTime;
  }
  else if (adjTime <= 25) {
    recalOffset = adjTime;
  }

  console.log("Mid down, calculated offset: " + recalOffset);

  recalButtonVisible = false;
  elid("recalButton").classList.add("d-none");
}

// Update clock and attacks UI
function updateTimerUI() {
  if (!isPaused) {
    let upcomingAttack = 0;
    let incomingAttack = 0;
    let attackTime = 0;
    let oldAdjTime = 0;
    let count = 0;
    let time = Date.now() - startDate;
    let adjTime = new Date(time < 0 ? 0 : time).getTime();

    // Update clock
    let timeString = new Date(adjTime).toISOString().substr(14, 5);
    message(timeString, "timerBox");
    
    // Apply all offsets for attack calculations etc.
    adjTime = (adjTime / 1000) - attackOffset - recalOffset;
    
    // Check if fight is at least at or past first mid
    if (adjTime >= 143 + midOffset) {
      let totalTime = 147 + midOffset;
      oldAdjTime = adjTime;
      adjTime = adjTime % totalTime;
      
      if (adjTime < 0) {
        adjTime = oldAdjTime - recalOffset;
      }
    }
    
    if (!isAttackable) {
      for (var key in attacks) {
        // Check if this is an incoming attack
        if ((parseInt(key) - 4) < adjTime && adjTime < (parseInt(key) + 9)) {
          // Check if this is the last attack (Mid energy fungi)
          if (count == (Object.keys(attacks).length - 1)) {
            if (adjTime < (parseInt(key) + 7)) {
              incomingAttack = key;
              upcomingAttack = 0;
              attackTime = parseInt(key);
            } 
            else if (!recalButtonVisible && ((parseInt(key) + 7) <= adjTime && adjTime < (parseInt(key) + 9))) {
              recalButtonVisible = true;
              elid("recalButton").classList.remove("d-none");
            }
          }
          // This is different attack
          else if (adjTime < (parseInt(key) + 3)) {
            incomingAttack = key;
            upcomingAttack = parseInt(count) + 1;
            attackTime = parseInt(key);
            
            if (recalButtonVisible) {
              recalButtonVisible = false;
              elid("recalButton").classList.add("d-none");
            }

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

// Updates the incoming & upcoming attacks on the interface
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
    updateTooltip();
    message("");
  }
  
  if (incomingAttack != 0 && currentTooltip == "") {
    if (tooltipSetting == 1) {
      updateTooltip(attacks[incomingAttack][0]);
    }
    else if (tooltipSetting == 2) {
      updateTooltip(attacks[incomingAttack][1]);
    }
    else if (tooltipSetting == 3) {
      updateTooltip(attacks[incomingAttack][0] + ", " + attacks[incomingAttack][1]);
    }
  }

  if (upcomingAttack != 0) {
    let keys = Object.keys(attacks);
    message("Next attack: " + attacks[keys[upcomingAttack]][0], "upcomingBox");
  }
}

// Updates the text in the tooltip
function updateTooltip(str = "") {
  currentTooltip = str;

  if (currentTooltip != "") {
    if (!alt1.setTooltip(" " + currentTooltip)) {
      console.log("Error: No tooltip permission");
    }
  }
  else {
    alt1.clearTooltip();
  }
}

// Reading & parsing info from the buff bar
function readBuffBar() {
  // Only check if crystalmask detection is enabled
  if (crystalMaskSetting != 0) {
    // First check if a buff bar has already been found, if not look for one now
    if (buffReader.pos === null) {
      console.log("Error: Unable to find buffbar");

      buffReader.find();
    }
    else {
      let buffReadout = buffReader.read();
      const image = new Image;
      image.src = "./assets/crystalmask.png";
      image.onload = () => {
        let imgFound = false;

        ctx.drawImage(image, 0, 0);
        imageData = ctx.getImageData(0, 0, 25, 25);
        
        // Iterate through all buffs to find a buff matching the imgSrc
        for (var buffObj in buffReadout) {
          let countMatch = buffReadout[buffObj].countMatch(imageData,false).passed;
          
          if (countMatch >= 70) {
            imgFound = true;
          }
        }

        // Add border if buff is found
        if (imgFound && !crystalMaskActive) {
          crystalMaskActive = true;
      
          elid("body").classList.add("green-border");
          elid("body").classList.remove("red-border");
        }
        else if (crystalMaskActive && !imgFound) {
          crystalMaskActive = false;
  
          elid("body").classList.remove("green-border");
          elid("body").classList.add("red-border");
    
          // Play sound if enabled in settings
          if (crystalMaskSetting === 2) {
            alertSound.play();
            //alt1.overLayTextEx("Crystalmask has shattered!", A1lib.mixColor(0, 255, 0), 25,parseInt(alt1.rsWidth/2),parseInt((alt1.rsHeight/2)-300),3000,"monospace",true,true);
          }
        }
      }
    }
  }
}

// Start of boss encounter
function startEncounter(offset = 0) {
  isPaused = false;
  attackEndCount = 0;
  startDate = Date.now() + offset;
  
  message("Encounter started");
  message("Next attack: Red bomb","upcomingBox");
}

// End of boss encounter
function stopEncounter() {
  isPaused = true;
  isAttackable = false;
  recalButtonVisible = false;
  currentTooltip = "";
  lastUpcomingMessage = "";
  attackOffset = 0;
  recalOffset = 0;
  intervalCount = 0;

  updateTooltip();

  elid("recalButton").classList.add("d-none");
  message("Encounter ended\nAwaiting boss start...");
  message("","upcomingBox");
}

// Start of core attack
function startAttack() {
  isAttackable = true;
  lastUpcomingMessage = document.getElementById('upcomingBox').textContent;

  // Make sure to make mid down button invisible
  elid("recalButton").classList.add("d-none");
  
  // Change messages in incoming/upcoming attacks boxes
  message("","upcomingBox");
  message("Croesus is vulnerable,\nattack the core!");
  
  attackStartDate = Date.now();
}

// End of core attack
function endAttack() {
  isAttackable = false;

  updateTooltip();
  
  message(lastUpcomingMessage,"upcomingBox");
  message("");
  
  attackOffset = attackOffset + (Date.now() - attackStartDate) / 1000;
  console.log("Attack ended, time offset: " + attackOffset);
}

// Increases timer by time
function nudgeTimer(time) {
  startDate = new Date(startDate).getTime() + time;
  
  updateTimerUI();
}

// Updates the text inside element
function message(str,elementId="incomingBox") {
  elid(elementId).innerHTML=str;
}

// Gets called when user presses the alt + 1 keybind.
function alt1onrightclick(obj) {
  calculateMidOffset();
}

// Update the selected chatbox with new value from localstorage
function chatChange() { 
  if (localStorage.susChat && parseInt(localStorage.susChat) < chatReader.pos.boxes.length) {
    chatReader.pos.mainbox = chatReader.pos.boxes[localStorage.susChat];

    showSelectedChat(chatReader.pos);

    console.log("Chat changed to: " + localStorage.susChat);
  } 
}

// Update the crystal mask setting with new value from localstorage
function cMaskChange() {
  if (localStorage.susCMask) {
    crystalMaskSetting = parseInt(localStorage.susCMask);

    if (crystalMaskSetting == 0) {
      clearInterval(buffReadInterval);
      buffReadInterval = null;
      crystalMaskActive = false;
  
      elid("body").classList.remove("green-border");
      elid("body").classList.remove("red-border");
    }
    else if (buffReadInterval === null) {
      buffReadInterval = setInterval(function () {
        readBuffBar();
      }, 600);
    }

    console.log("Crystal mask setting changed to: " + crystalMaskSetting);
  }
}

// Update the tooltip setting with new value from localstorage
function tooltipChange() {
  if (localStorage.susTT) {
    tooltipSetting = parseInt(localStorage.susTT);

    updateTooltip();

    console.log("Tooltip setting changed to: " + tooltipSetting);
  }
}

// Update the start delay with new value from localstorage
function startOffsetChange() {
  if (localStorage.susStartDelay) {
    startOffset = parseInt(localStorage.susStartDelay);

    console.log("Start delay changed to: " + startOffset);
  }
}

// Update the mid delay with new value from localstorage
function midOffsetChange() {
  if (localStorage.susMidDelay) {
    midOffset = parseInt(localStorage.susMidDelay);

    console.log("Mid delay changed to: " + midOffset);
  }
}

function getChatReader() {
  return chatReader;
}

$('document').ready(function() {
  alertSound.volume = 0.3;

  $("#recalButton").click(function () {
    calculateMidOffset();
  });

  $("#plusButton").click(function () {
    nudgeTimer(-1000);
  });

  $("#minusButton").click(function () {
    nudgeTimer(1000);
  });

  // Check for saved start delay & set it
  if (localStorage.susStartDelay) {
    startOffset = parseInt(localStorage.susStartDelay);
  }
  
  // Check for saved delay & set it
  if (localStorage.susMidDelay) {
    midOffset = parseInt(localStorage.susMidDelay);
  }
    
  // Check for saved tooltipSetting & set it
  if (localStorage.susTT) {
    tooltipSetting = parseInt(localStorage.susTT);
  }

  // Check for legacy tooltip setting, set it & remove it
  if (localStorage.susTooltip) {
    let legacyTtSetting = JSON.parse(localStorage.susTooltip);

    if (!legacyTtSetting) {
      tooltipSetting = 0;
      localStorage.setItem("susTT", tooltipSetting);
    }

    localStorage.removeItem("susTooltip");
  }

  // Check for saved crystalmask detection & set it
  if (localStorage.susCMask) {
    crystalMaskSetting = parseInt(localStorage.susCMask);

    buffReadInterval = setInterval(function () {
      readBuffBar();
    }, 600);
  }
});