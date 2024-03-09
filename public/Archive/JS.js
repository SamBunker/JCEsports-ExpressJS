  /*Carousel JS for the timer and only showing one image at once*/
  let slideIndex = 0;
  showSlides();
  
  function showSlides() {
    let i;
    let slides = document.getElementsByClassName("mySlides");
    let dots = document.getElementsByClassName("dot");
    for (i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";
    }
    slideIndex++;
    if (slideIndex > slides.length) {
      slideIndex = 1;
    }
    for (i = 0; i < dots.length; i++) {
      dots[i].className = dots[i].className.replace(" active", "");
    }
    slides[slideIndex - 1].style.display = "block";
    dots[slideIndex - 1].className += " active";
    setTimeout(showSlides, 3500); // Change image every 3.5 seconds
  }

/*For changing color of the hovered link in the navbar*/
 document.addEventListener('DOMContentLoaded', function() {
  var navbarLinks = document.querySelectorAll('.nav-list li a');

  navbarLinks.forEach(function(link) {
    link.addEventListener('mouseover', function() {
      link.classList.add('hovered-link');
    });

    link.addEventListener('mouseout', function() {
      link.classList.remove('hovered-link');
    });
  });
});