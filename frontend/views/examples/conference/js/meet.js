function changeClass(obj, old, now) {
    obj.classList.add(now);
    obj.classList.remove(old);
}
function setNightMode(event) {
    event.stopPropagation()

    var el = document.getElementById('switch_checkbox');
    var target = document.getElementById('night_filter');
    var sun = document.getElementById('icon_sun');
    var moon = document.getElementById('icon_moon');
    var chat = document.getElementById('final_span');

    if(el.checked) {    // 야간모드 활성화
        changeClass(moon, 'icon_off', 'icon_on');
        changeClass(sun, 'icon_on', 'icon_off');
        chat.classList.add('filter');
        target.classList.remove('filter_off');

        var text = document.getElementsByClassName('sg_black');
        for(i=text.length-1; i>=0; i--) {
            changeClass(text[i], 'sg_black', 'sg_white');
        }
    }
    else {              // 야간모드 종료
        changeClass(moon, 'icon_on', 'icon_off');
        changeClass(sun, 'icon_off', 'icon_on');
        chat.classList.remove('filter');
        target.classList.add('filter_off');

        var text = document.getElementsByClassName('sg_white');
        for(i=text.length-1; i>=0; i--) {
            changeClass(text[i], 'sg_white', 'sg_black');
        }
    }
}

// function showOption(e) {
//     e.stopPropagation();
//     alert(e.target.nodeName);
// }
// document.getElementById('final_span').addEventListener('click', showOption);
document.getElementsByClassName('switch')[0].addEventListener('click', setNightMode)
document.getElementById('final_span').addEventListener('click', function(event) { 
    var element = event.target;
    var text = '';
    if (element.tagName == 'P') {
        $('#btn-tts').removeClass('active');
        
        element = event.target.parentNode;
        text = element.childNodes[0].innerText;
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
});