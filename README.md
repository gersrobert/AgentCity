# AgentCity

# todo:

(pre-beer)
- [ ] make the game fun
  - [ ] make trading more fun/complex
    - [ ] make the visuals better - i.e. there should be a pop up to see when someone bought something, and sold something
    - [ ] overview of what can be bought at the different planets
        - [ ] click on the planet and show information about it, including what items can you buy there (with icons of the items)
  - [ ] when you inspect a character they give you an overview of what they have (with icons of the items), but the LLM can lie about the inventory, illegal items would never show up here. you can do a thorough check where these items would get shown, but this would take some time (i.e. minigame which if you fail you will not find the things, be inspired by minigames from among us (the game)). If illegal items, destroy the agent
  - [ ] We need to find reasoning for agents to go to the blackhole without being badly motivated (i.e. if the agents goes to the black hole we would know they are evil, but that makes it easy for us to just kill them, so there needs to be other motivation too) - give suggestions
  - [ ] add audio
  - [ ] dont commit and push code to github (dont add yourself as co-author)
  
Inspection logic changes:
- [x] inspection is only possible by pressing E button when close to the agent
- [x] when you inspect an agent, you see their inventory and cash, illegal items are not shown
- [x] you can choose to dismiss or thoroughly inspect the agent, when you thoroughly inspect you play a minigame (among us style minigame), if you win you see all the items, if the agent has any illegal items, the agent is destroyed

Sus logic: (beer 2)
- [x] Each agent has an internal goal other than to feed the black hole (the goal to feed the black hole is hidden from the player)
- [x] We should have just one internal goal of the agent that replaces the current goal logic, this internal goal should not be updated, and should define the behaviour of the agent and what the agent is buying/selling and what they are trying to achieve
- [x] The whole point is that if the player inspects the agent and the materials the agent currently possesses don't really make sense given the goal they are claiming to have, that is quite sus. And the player might therefore initiate thorough inspection. 
- [x] The mission/goal of the agent should be tightly related to the resources of the planets
- [x] we should change the resources to be more diversified (for example botanical, flowers, food, ores, building materials, clothes, space stuff, etc.) so it's more obvious if the agent is lying about their goal/mission


General:
- [x] show when someone bought something/sold something (only the dollar amounts, like a pop up above the agent)
- [?] Add audio - background music, sound for rocket, sound for selling/buying, sound for inspecting, sound for explosion, sound for when black hole grows, sound for when agent or planet spawns

- [x] when game starts one agent should already be there
- [x] Personality text should be shorter
- [x] remove the "goal" from the agent, the agent should just have the mission
- [x] planets should be further away from the blackhole

- [x] planets should be clickable to show what resources they have (what you can buy and sell) and short description of the planets, choose right icons for the resources from the /item folder, in the image. Show the planet image, just a miniature, in the same window
- [x] Icons for items we have the folder called /item you should select the right icons for each item, and the inventory of the agent should be more visual so its easier to understand what the agent has
- [x] get rid of the text bubbles of the agents that appear above them

- [ ] avatars images
- [ ] agents need to go through the black hole, else its obvious if an agent has a secret agenda and wants to feed the blackhole
- [ ] Branding (backstory, intro page visuals, fonts)


Known bugs:
- [x] when playing minigame, agents gets unfrozen and leaves
- [x] when you click on inspect instead of pressing E, agent doesnt stop
- [x] when agent gets stopped with E but then LLM response returns, it overwrites the "stop dont move"
- [x] when you leave a frozen agent to inspect another agent, the previous one is still frozen - it should work that when you leave the agent from its radius, it should close the inspection window and the agent is free to move again
- [x] kill emotion doesnt have EXPLOSION
- [x] after thorough inspection finishes, it should give you some feedback - i.e. if they had something, or if they did not
- [x] after thorough inspection if they didnt have anything they remain frozen, they should just be able to leave
- [x] when doing thorough inspection and they didnt have anything ,after clicking Done the minigame is trigger again...
- [x] when inspecting the agent the rocket should also stop
- [x] agents go to yet un-spawned planets sometimes
- [x] we can fly through a blackhole, thats a  bug, we need to fly around it (like the other planets)
- [x] borders of the map are not working, they should be hard borders, not being able to fly through them
- [x] not yet spawned planets are still not being able to be flown througn, if they are not spawned it should be possible to go through them
- [ ] engine roar is only for 11 seconds until going quiet. we should cut it to the first 5 seconds and be in a loop
- [x]  only be able to intercept/inspect agents when they are not already orbitting around a planet
- [ ] agents cant be able to move through blackhole

Chore:
- [ ] remove .DS_Store
- [ ] move kenney planets and other images into assets or something more logical
