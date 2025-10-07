(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const width = canvas.width;
  const height = canvas.height;

  (() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    // Configurações do jogo
    const gravity = 0.4;
    const baseJumpStrength = -10;
    const moveSpeed = 4;
    const platformWidth = 70;
    const platformHeight = 12;
    const playerRadius = 20;

    // Estados do bônus
    const bonusTypes = {
      NONE: 'none',
      HIGH_JUMP: 'high_jump',
      SHIELD: 'shield',
      POINTS: 'points'
    };

    // Sons simples (usando Web Audio API)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    function playJumpSound() {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }

    function playBonusSound() {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    }

    // Variáveis de controle
    let keys = { left: false, right: false };
    let score = 0;
    let maxHeight = 0;
    let gameOver = false;

    // Player
    let player = {
      x: width / 2,
      y: height - playerRadius - 10,
      radius: playerRadius,
      dx: 0,
      dy: 0,
      jumpStrength: baseJumpStrength,
      bonus: bonusTypes.NONE,
      bonusTimer: 0,
      shieldActive: false,
    };

    // Plataformas
    class Platform {
      constructor(x, y, width, height, isMoving = false, speed = 1) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.isMoving = isMoving;
        this.speed = speed;
        this.direction = 1;
      }

      update() {
        if (this.isMoving) {
          this.x += this.speed * this.direction;
          if (this.x <= 0 || this.x + this.width >= width) {
            this.direction *= -1;
          }
        }
      }

      draw() {
        ctx.fillStyle = '#2b8a3e'; // verde plataforma
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // borda
        ctx.strokeStyle = '#16691e';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
      }
    }

    // Obstáculos
    class Obstacle {
      constructor(x, y, size = 30) {
        this.x = x;
        this.y = y;
        this.size = size;
      }

      update(dy) {
        this.y += dy;
      }

      draw() {
        ctx.fillStyle = '#aa2222';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.size / 2, this.y + this.size);
        ctx.lineTo(this.x - this.size / 2, this.y + this.size);
        ctx.closePath();
        ctx.fill();
      }

      collidesWith(px, py, pr) {
        // Colisão simples: círculo contra triângulo bounding box
        let distX = Math.abs(px - this.x);
        let distY = Math.abs(py - this.y - this.size/2);
        if (distX < pr + this.size/2 && distY < pr + this.size/2) {
          return true;
        }
        return false;
      }
    }

    // Itens bônus
    class Bonus {
      constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = 20;
        this.active = true;
      }

      update(dy) {
        this.y += dy;
      }

      draw() {
        if (!this.active) return;
        ctx.fillStyle = {
          [bonusTypes.HIGH_JUMP]: '#ffcc00',
          [bonusTypes.SHIELD]: '#0099ff',
          [bonusTypes.POINTS]: '#ff66cc',
          [bonusTypes.NONE]: '#ccc'
        }[this.type] || '#ccc';

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let symbol = {
          [bonusTypes.HIGH_JUMP]: '↑',
          [bonusTypes.SHIELD]: '🛡',
          [bonusTypes.POINTS]: '+',
        }[this.type] || '?';

        ctx.fillText(symbol, this.x, this.y);
      }

      collidesWith(px, py, pr) {
        let dx = this.x - px;
        let dy = this.y - py;
        let distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.size / 2 + pr);
      }
    }

    // Lista dos elementos
    let platforms = [];
    let obstacles = [];
    let bonuses = [];

    // Cria plataforma inicial (chão)
    function createInitialPlatform() {
      platforms.push(new Platform(0, height - 10, width, 10, false));
    }

    // Cria plataformas regulares aleatórias (fixas ou móveis)
    function createPlatforms() {
      const count = 7;
      let yPos = height - 100;
      for (let i = 0; i < count; i++) {
        let x = Math.random() * (width - platformWidth);
        let isMoving = Math.random() < 0.4; // 40% móveis
        let speed = isMoving ? (1 + Math.random() * 1.5) : 0;
        platforms.push(new Platform(x, yPos, platformWidth, platformHeight, isMoving, speed));
        yPos -= 90 + Math.random() * 40;
      }
    }

    // Criar obstáculos em plataformas para aumentar dificuldade
    function createObstacles() {
      obstacles = [];
      for (let p of platforms) {
        if (p.isMoving) {
          // chance maior em plataformas móveis
          if (Math.random() < 0.5) {
            let ox = p.x + Math.random() * p.width;
            let oy = p.y - 30;
            obstacles.push(new Obstacle(ox, oy));
          }
        } else {
          if (Math.random() < 0.2) {
            let ox = p.x + Math.random() * p.width;
            let oy = p.y - 30;
            obstacles.push(new Obstacle(ox, oy));
          }
        }
      }
    }

    // Criar bônus em plataformas
    function createBonuses() {
      bonuses = [];
      const bonusTypesArray = [bonusTypes.HIGH_JUMP, bonusTypes.SHIELD, bonusTypes.POINTS];
      for (let p of platforms) {
        if (Math.random() < 0.25) {
          let bx = p.x + p.width / 2;
          let by = p.y - 25;
          let btype = bonusTypesArray[Math.floor(Math.random() * bonusTypesArray.length)];
          bonuses.push(new Bonus(bx, by, btype));
        }
      }
    }

    // Resetar jogo
    function resetGame() {
      player.x = width / 2;
      player.y = height - playerRadius - 10;
      player.dy = 0;
      player.dx = 0;
      player.bonus = bonusTypes.NONE;
      player.bonusTimer = 0;
      player.shieldActive = false;
      player.jumpStrength = baseJumpStrength;
      score = 0;
      maxHeight = player.y;

      platforms = [];
      obstacles = [];
      bonuses = [];
      createInitialPlatform();
      createPlatforms();
      createObstacles();
      createBonuses();

      gameOver = false;
      document.getElementById('game-over').style.display = 'none';
      updateScore();
      if(audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Controle de teclas
    window.addEventListener('keydown', e => {
      if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
      if(e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    });
    window.addEventListener('keyup', e => {
      if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if(e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    });

    // Controle para toque/móvel (opcional)
    canvas.addEventListener('touchstart', e => {
      const touchX = e.touches[0].clientX - canvas.getBoundingClientRect().left;
      if (touchX < width / 2) {
        keys.left = true;
      } else {
        keys.right = true;
      }
    });
    canvas.addEventListener('touchend', e => {
      keys.left = false;
      keys.right = false;
    });

    // Atualiza placar
    function updateScore() {
      document.getElementById('scoreboard').innerText = `Pontos: ${Math.floor(score)}`;
    }

    // Detecta colisão plataforma para pulo automático
    function checkPlatformCollision() {
      for (let p of platforms) {
        if (
          player.dy > 0 &&
          player.x + player.radius > p.x &&
          player.x - player.radius < p.x + p.width &&
          player.y + player.radius > p.y &&
          player.y + player.radius < p.y + p.height + 10
        ) {
          return p;
        }
      }
      return null;
    }

    // Detecta colisão com obstáculos
    function checkObstacleCollision() {
      for(let ob of obstacles) {
        if(ob.collidesWith(player.x, player.y, player.radius)) {
          return ob;
        }
      }
      return null;
    }

    // Detecta colisão com bônus
    function checkBonusCollision() {
      for(let b of bonuses) {
        if(b.active && b.collidesWith(player.x, player.y, player.radius)) {
          return b;
        }
      }
      return null;
    }

    // Atualiza a física e lógica
    function update() {
      if (gameOver) return;

      // Movimento lateral pelo jogador
      if (keys.left) player.dx = -moveSpeed;
      else if (keys.right) player.dx = moveSpeed;
      else player.dx = 0;

      player.x += player.dx;

      // Tela infinita horizontal
      if (player.x < 0) player.x = width;
      if (player.x > width) player.x = 0;

      // Gravidade
      player.dy += gravity;
      player.y += player.dy;

      // Checar colisão plataforma
      let platform = checkPlatformCollision();
      if (platform) {
        if(player.dy > 0) {
          // Salto automático
          player.dy = player.jumpStrength;
          playJumpSound();
        }
      }

      // Atualiza plataformas móveis
      platforms.forEach(p => p.update());

      // Atualiza obstáculos e bônus - eles sobem conforme jogador sobe
      let scrollSpeed = 0;
      if(player.y < height / 2) {
        scrollSpeed = (height / 2) - player.y;
        player.y = height / 2;

        platforms.forEach(p => {
          p.y += scrollSpeed;
          if(p.y > height) {
            p.y = 0;
            p.x = Math.random() * (width - platformWidth);
            p.isMoving = Math.random() < 0.4;
            p.speed = p.isMoving ? (1 + Math.random() * 1.5) : 0;
            p.direction = 1;
          }
        });

        obstacles.forEach(o => {
          o.update(scrollSpeed);
          if(o.y > height) {
            o.y = 0;
            o.x = Math.random() * width;
          }
        });

        bonuses.forEach(b => {
          b.update(scrollSpeed);
          if(b.y > height) {
            b.active = false;
          }
        });

        // Atualiza pontuação baseado na altura alcançada
        score += scrollSpeed * 0.1;
        updateScore();
      }

      // Checar colisão com obstáculos
      let obstacle = checkObstacleCollision();
      if(obstacle && !player.shieldActive) {
        gameOver = true;
        showGameOver();
        return;
      }

      // Checar colisão com bônus
      let bonus = checkBonusCollision();
      if(bonus) {
        bonus.active = false;
        playBonusSound();
        // Aplicar bônus
        switch(bonus.type) {
          case bonusTypes.HIGH_JUMP:
            player.bonus = bonusTypes.HIGH_JUMP;
            player.jumpStrength = baseJumpStrength * 1.6;
            player.bonusTimer = 600; // ~10 segundos (60fps)
            break;
          case bonusTypes.SHIELD:
            player.bonus = bonusTypes.SHIELD;
            player.shieldActive = true;
            player.bonusTimer = 600;
            break;
          case bonusTypes.POINTS:
            score += 100;
            updateScore();
            break;
        }
      }

      // Atualiza temporizador de bônus
      if(player.bonus !== bonusTypes.NONE) {
        player.bonusTimer--;
        if(player.bonusTimer <= 0) {
          player.bonus = bonusTypes.NONE;
          player.jumpStrength = baseJumpStrength;
          player.shieldActive = false;
          player.bonusTimer = 0;
        }
      }

      // Game over se cair fora da tela
      if(player.y - player.radius > height) {
        if(player.shieldActive) {
          // Consome escudo ao cair
          player.shieldActive = false;
          player.bonus = bonusTypes.NONE;
          player.bonusTimer = 0;
          player.dy = baseJumpStrength; // impulso para voltar ao jogo
          playJumpSound();
        } else {
          gameOver = true;
          showGameOver();
        }
      }
    }

    // Desenha o personagem
    function drawPlayer() {
      // Corpo
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y, player.radius, player.radius * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Olhos
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(player.x - 7, player.y - 5, 5, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(player.x + 7, player.y - 5, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupilas
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(player.x - 6, player.y - 6, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(player.x + 8, player.y - 6, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boca simples
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y + 8, 10, 0, Math.PI);
      ctx.stroke();

      // Escudo visual se ativo
      if(player.shieldActive) {
        ctx.strokeStyle = '#0099ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(player.x, player.y, player.radius + 6, player.radius * 1.1 + 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Desenha a pontuação no canto superior
    function drawScore() {
      // Já feita via DOM para clareza
    }

    // Mostra tela de Game Over
    function showGameOver() {
      document.getElementById('final-score').innerText = `Você fez ${Math.floor(score)} pontos!`;
      document.getElementById('game-over').style.display = 'block';
    }

    // Loop principal
    function loop() {
      ctx.clearRect(0, 0, width, height);

      // Desenhar plataformas
      platforms.forEach(p => p.draw());

      // Desenhar obstáculos
      obstacles.forEach(o => o.draw());

      // Desenhar bônus
      bonuses.forEach(b => b.draw());

      // Desenhar jogador
      drawPlayer();

      // Atualizar lógica
      update();

      if(!gameOver) requestAnimationFrame(loop);
    }

    // Botão reiniciar
    document.getElementById('restart-btn').addEventListener('click', () => {
      resetGame();
      loop();
    });

    // Começar o jogo
    resetGame();
    loop();

  })();
})();
