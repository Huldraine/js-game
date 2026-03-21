const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
let touche = ''

canvas.width = 1024
canvas.height = 576

class Sprite {
   constructor(position, velocity) {
        this.position = position
        this.velocity = velocity
   } 

   draw() {
        c.fillStyle = 'red'
        c.fillRect(this.position.x, this.position.y, 50, 150)
   }
}

const player = new Sprite({
    x: 0,
    y: 0
})

const enemy = new Sprite({
    x: 400,
    y: 100
})

document.addEventListener('keydown', (event) => {
    touche = event.key;
});

function animate() {
    window.requestAnimationFrame(animate)
    
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)

    if (touche === 'z'){
        player.position.y -= 10
    }
    if (touche === 'q'){
        player.position.x -= 10
    }
    if (touche === 's'){
        player.position.y += 10
    }
    if (touche === 'd'){
        player.position.x += 10
    }

    if (touche === 'ArrowUp'){
    player.position.y -= 10
    }
    if (touche === 'ArrowLeft'){
        player.position.x -= 10
    }
    if (touche === 'ArrowDown'){
        player.position.y += 10
    }
        if (touche === 'ArrowRight'){
        player.position.x += 10
    }
    player.draw()
    enemy.draw()
    touche = ''
}

animate()