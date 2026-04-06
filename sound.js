export function playSound(src, loop = false) {
    try {
        const audio = new Audio(src)
        audio.loop = !!loop
        // Attempt to play; browsers may block autoplay until user interaction
        audio.play().catch(err => {
            console.warn('playSound: autoplay blocked or error', err)
        })
        return audio
    } catch (e) {
        console.warn('playSound error', e)
        return null
    }
}

export default playSound
