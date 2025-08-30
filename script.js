document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const playerHandElement = document.getElementById('player-hand');
    const aiHandElement = document.getElementById('ai-hand');
    const deckElement = document.getElementById('deck');
    const discardPileElement = document.getElementById('discard-pile');
    const colorPickerModal = document.getElementById('color-picker-modal');
    const colorOptions = document.querySelector('.color-options');

    // --- Game State ---
    let deck = [];
    let playerHand = [];
    let aiHand = [];
    let discardPile = [];
    let isPlayerTurn = true;
    let chosenColor = null; // For wild cards

    // --- Game Logic ---
    const colors = ['red', 'yellow', 'green', 'blue'];
    const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

    function createDeck() {
        const newDeck = [];
        colors.forEach(color => {
            values.forEach(value => {
                newDeck.push({ color, value });
                if (value !== '0') newDeck.push({ color, value });
            });
        });
        for (let i = 0; i < 4; i++) {
            newDeck.push({ color: 'wild', value: 'wild' });
            newDeck.push({ color: 'wild', value: 'wild_draw4' });
        }
        return newDeck;
    }

    function shuffleDeck(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function dealCards() {
        playerHand = [];
        aiHand = [];
        for (let i = 0; i < 7; i++) {
            playerHand.push(deck.pop());
            aiHand.push(deck.pop());
        }
    }

    function startGame() {
        deck = createDeck();
        shuffleDeck(deck);
        dealCards();
        discardPile = [];

        let firstCard = deck.pop();
        while (firstCard.value === 'wild_draw4') {
            deck.push(firstCard);
            shuffleDeck(deck);
            firstCard = deck.pop();
        }
        discardPile.push(firstCard);

        // If the first card is a wild card, the first player (human) chooses the color.
        if (firstCard.color === 'wild') {
           // In a real game, the player who dealt would choose. Here we can let the player choose.
           // For simplicity, we'll just re-render and let the player play on it.
        } else {
            chosenColor = firstCard.color;
        }

        isPlayerTurn = true; // Player always starts
        render();
    }

    function render() {
        // Player's Hand
        playerHandElement.innerHTML = '';
        playerHand.forEach((card, index) => {
            playerHandElement.appendChild(createCardElement(card, index));
        });

        // AI's Hand
        aiHandElement.innerHTML = '';
        aiHand.forEach(() => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card back';
            aiHandElement.appendChild(cardElement);
        });

        // Discard Pile
        discardPileElement.innerHTML = '';
        const topCard = discardPile[discardPile.length - 1];
        if (topCard) {
            const topCardElement = createCardElement(topCard);
            // If the top card is a wild card that has been colored, show the chosen color
            if (topCard.color === 'wild' && chosenColor) {
                 topCardElement.style.backgroundColor = chosenColor;
            }
            discardPileElement.appendChild(topCardElement);
        }

        // Update active turn indicator
        if (isPlayerTurn) {
            playerHandElement.classList.add('active-turn');
            aiHandElement.classList.remove('active-turn');
        } else {
            playerHandElement.classList.remove('active-turn');
            aiHandElement.classList.add('active-turn');
        }
    }

    function createCardElement(card, index) {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${card.color}`;
        if(card.color === 'wild') {
             cardElement.style.background = 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)';
        } else {
             cardElement.style.backgroundColor = card.color;
        }

        let content = '';
        switch(card.value) {
            case 'skip': content = 'S'; break;
            case 'reverse': content = 'R'; break;
            case 'draw2': content = '+2'; break;
            case 'wild': content = 'W'; break;
            case 'wild_draw4': content = '+4'; break;
            default: content = card.value;
        }
        cardElement.textContent = content;
        cardElement.dataset.index = index;
        return cardElement;
    }

    function isValidPlay(card) {
        const topCard = discardPile[discardPile.length - 1];
        if (card.color === 'wild') return true;
        if (card.value === 'wild_draw4') {
             // Check if player has any other card with the same color as the top card
             const canPlayOtherCard = playerHand.some(c => c.color === chosenColor);
             return !canPlayOtherCard;
        }
        return card.color === chosenColor || card.value === topCard.value;
    }

    function playerTurn(e) {
        if (!isPlayerTurn || !e.target.closest('.card')) return;
        const cardIndex = e.target.closest('.card').dataset.index;
        const card = playerHand[cardIndex];

        if (isValidPlay(card)) {
            playCard(cardIndex, 'player');
        }
    }

    function playCard(cardIndex, player) {
        const hand = (player === 'player') ? playerHand : aiHand;
        const [playedCard] = hand.splice(cardIndex, 1);
        discardPile.push(playedCard);

        handleSpecialCard(playedCard, player);
    }

    function handleSpecialCard(card, player) {
        let turnEnds = true;

        switch (card.value) {
            case 'skip':
            case 'reverse': // In 2-player, skip and reverse have the same effect
                turnEnds = false; // Player/AI gets another turn
                break;
            case 'draw2':
                drawCards(player === 'player' ? 'ai' : 'player', 2);
                break;
            case 'wild':
                if (player === 'player') {
                    showColorPicker(card);
                    turnEnds = false; // Turn ends after color is picked
                } else {
                    chosenColor = chooseBestColorForAI();
                    endTurn();
                }
                return; // Exit because we are waiting for user input or AI has ended its turn
            case 'wild_draw4':
                drawCards(player === 'player' ? 'ai' : 'player', 4);
                 if (player === 'player') {
                    showColorPicker(card);
                    turnEnds = false; // Turn ends after color is picked
                } else {
                    chosenColor = chooseBestColorForAI();
                    endTurn();
                }
                return;
        }

        if (card.color !== 'wild') {
            chosenColor = card.color;
        }

        if (turnEnds) {
            endTurn();
        } else {
            // If the turn doesn't end (skip/reverse), re-render and wait for the next move
            render();
        }
    }

    function drawCards(player, count) {
        const hand = (player === 'player') ? playerHand : aiHand;
        for(let i=0; i < count; i++) {
            if (deck.length === 0) replenishDeck();
            hand.push(deck.pop());
        }
    }

    function replenishDeck() {
        const top = discardPile.pop();
        deck.push(...discardPile);
        discardPile = [top];
        shuffleDeck(deck);
    }

    function endTurn() {
        if(checkGameOver()) return;
        isPlayerTurn = !isPlayerTurn;
        render();
        if (!isPlayerTurn) {
            setTimeout(aiTurn, 1000);
        }
    }

    function aiTurn() {
        let bestCardIndex = -1;
        for (let i = 0; i < aiHand.length; i++) {
            if (isValidPlay(aiHand[i])) {
                bestCardIndex = i;
                break; // Simple AI: play the first valid card
            }
        }

        if (bestCardIndex !== -1) {
            playCard(bestCardIndex, 'ai');
        } else {
            drawCards('ai', 1);
            endTurn();
        }
    }

    function chooseBestColorForAI() {
        const colorCounts = { red: 0, yellow: 0, green: 0, blue: 0 };
        aiHand.forEach(card => {
            if (card.color !== 'wild') {
                colorCounts[card.color]++;
            }
        });
        return Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
    }

    function showColorPicker() {
        colorPickerModal.classList.remove('hidden');
    }

    function hideColorPicker() {
        colorPickerModal.classList.add('hidden');
    }

    function onColorPick(e) {
        if (!e.target.classList.contains('color-option')) return;
        chosenColor = e.target.dataset.color;
        hideColorPicker();
        endTurn();
    }

    function checkGameOver() {
        if (playerHand.length === 0) {
            alert('Congratulations! You won!');
            startGame();
            return true;
        }
        if (aiHand.length === 0) {
            alert('AI wins! Better luck next time.');
            startGame();
            return true;
        }
        return false;
    }

    // --- Event Listeners ---
    playerHandElement.addEventListener('click', playerTurn);
    deckElement.addEventListener('click', () => { if (isPlayerTurn) { drawCards('player', 1); endTurn(); } });
    colorOptions.addEventListener('click', onColorPick);

    // --- Start the game ---
    startGame();
});
