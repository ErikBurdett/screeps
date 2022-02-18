

const {debugLog} = require('./logging');

function handleQuests() {
  Memory.quests = Memory.quests || {};
  for (const id of Object.keys(Memory.quests)) {
    const quest = Memory.quests[id];

    if (!quest.checked && quest.check < Game.time) {
      debugLog('quests', `Spawn quester: ${JSON.stringify(quest)}`);
      Memory.quests[id].checked = true;
      Game.rooms[quest.origin].checkRoleToSpawn('quester', 1, undefined, quest.room, quest.id, quest.origin);
    }

    if (quest.end < Game.time) {
      debugLog('quests', `handleQuests quest ended: ${JSON.stringify(quest)}`);
      delete Memory.quests[id];
    }
  }
}

module.exports.handleQuests = handleQuests;

function getQuestBuildcs(data) {
  const quest = {};
  quest.room = data.room;
  quest.quest = 'buildcs';
  quest.end = Game.time + 15000;
  quest.check = Game.time + 0;
  return quest;
}

function getQuest(transaction, data) {
  const info = {};
  info.id = data.id;
  info.player = {
    name: transaction.sender.username,
    room: transaction.from,
  };
  info.origin = transaction.to;

  const quest = getQuestBuildcs(data);

  info.room = quest.room;
  info.quest = quest.quest;
  info.end = quest.end;
  info.check = quest.check;
  return info;
}


function haveActiveQuest() {
  debugLog('quests', `haveActiveQuest global.data.activeQuest: ${JSON.stringify(global.data.activeQuest)}`);
  if (!global.data.activeQuest) {
    return false;
  }
  if (global.data.activeQuest.state === 'applied' &&
      global.data.activeQuest.tick + 10 < Game.time) {
    debugLog('quests', 'Applied but too old');
    delete global.data.activeQuest;
    return false;
  }
  if (global.data.activeQuest.quest.end < Game.time) {
    delete global.data.activeQuest;
    return false;
  }
  return true;
}

module.exports.haveActiveQuest = haveActiveQuest;

function getQuestFromTransactionDescription(description) {
  let data;
  try {
    data = JSON.parse(description);
  } catch (e) {
    debugLog('quests', 'Quest transaction: Can not parse');
    return false;
  }
  if (data === null) {
    debugLog('quests', 'Quest transaction: No type');
    return false;
  }
  console.log(JSON.stringify(data));
  for (const key of ['type', 'room', 'id']) {
    if (!data[key]) {
      debugLog('quests', `Incoming transaction no Quest: No ${key}`);
      return false;
    }
  }
  if (data.type !== 'Quest') {
    debugLog('quests', 'Quest transaction: Type not quest');
    return false;
  }
  return data;
}

function checkQuestForAcceptance(transaction) {
  Memory.quests = Memory.quests || {};
  const data = getQuestFromTransactionDescription(transaction.description);
  if (!data) {
    return false;
  }
  if (Memory.quests[data.id]) {
    console.log(`Quest already ongoing ${JSON.stringify(data)}`);
    return;
  }
  const quest = getQuest(transaction, data);
  console.log(`Found quest acceptance on transaction ${JSON.stringify(quest)}`);

  Memory.quests[data.id] = quest;

  const response = {
    type: 'Accept',
    id: quest.id,
    room: quest.room,
    quest: quest.quest,
    end: quest.end,
  };
  const room = Game.rooms[transaction.to];
  console.log(`Send accept quest: ${JSON.stringify(response)}`);
  const terminalResponse = room.terminal.send(RESOURCE_ENERGY, 100, transaction.from, JSON.stringify(response));
  console.log(`terminalResponse ${JSON.stringify(terminalResponse)}`);
  // TODO find reserver in room and remove quest hint
}

module.exports.checkQuestForAcceptance = checkQuestForAcceptance;

function checkAppliedQuestForAcceptance(transaction) {
  try {
    const response = JSON.parse(transaction.description);
    if (!response.type) {
      debugLog('quests', `No type: ${JSON.stringify(response)}`);
    }
    if (response.type !== 'Accept') {
      return false;
    }
    debugLog('quests', `Quest accept transaction: ${JSON.stringify(response)}`);
    if (!haveActiveQuest()) {
      debugLog('quests', 'No active quest');
      return false;
    }
    global.data.activeQuest.state = 'active';
    global.data.activeQuest.accept = response;
    debugLog('quests', `activeQuest: ${JSON.stringify(global.data.activeQuest)}`);
  } catch (e) {
    console.log(e);
    return false;
  }
}
module.exports.checkAppliedQuestForAcceptance = checkAppliedQuestForAcceptance;