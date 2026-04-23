(function ($) {
  'use strict';

  // ----------------------------
  // AOS
  // ----------------------------
  AOS.init({
    once: true
  });

  
  $(window).on('scroll', function () {
		//.Scroll to top show/hide
    var scrollToTop = $('.scroll-top-to'),
      scroll = $(window).scrollTop();
    if (scroll >= 200) {
      scrollToTop.fadeIn(200);
    } else {
      scrollToTop.fadeOut(100);
    }
  });
	// scroll-to-top
  $('.scroll-top-to').on('click', function () {
    $('body,html').animate({
      scrollTop: 0
    }, 500);
    return false;
  });

  $(document).ready(function() {

    // navbarDropdown
    if ($(window).width() < 992) {
      $('.main-nav .dropdown-toggle').on('click', function (event) {
        var $toggle = $(this);
        var isServiceToggle = $toggle.closest('.service-nav').length > 0;
        var clickedIcon = $(event.target).closest('span, i').length > 0;

        if (isServiceToggle && !clickedIcon) {
          return;
        }

        event.preventDefault();

        var $parent = $toggle.parent('.dropdown');
        var $menu = $toggle.siblings('.dropdown-menu');
        var isOpen = $parent.hasClass('is-open');

        $('.main-nav .dropdown')
          .not($parent)
          .removeClass('is-open')
          .find('.dropdown-toggle')
          .attr('aria-expanded', 'false');

        $('.main-nav .dropdown')
          .not($parent)
          .find('.dropdown-menu')
          .removeClass('show')
          .stop(true, true)
          .slideUp(200);

        if (isOpen) {
          $parent.removeClass('is-open');
          $toggle.attr('aria-expanded', 'false');
          $menu.stop(true, true).slideUp(200, function () {
            $menu.removeClass('show');
          });
        } else {
          $parent.addClass('is-open');
          $toggle.attr('aria-expanded', 'true');
          $menu.addClass('show').stop(true, true).hide().slideDown(200);
        }
      });

      $(document).on('click', function (event) {
        if ($(event.target).closest('.main-nav .dropdown').length) {
          return;
        }

        $('.main-nav .dropdown')
          .removeClass('is-open')
          .find('.dropdown-toggle')
          .attr('aria-expanded', 'false');

        $('.main-nav .dropdown .dropdown-menu')
          .removeClass('show')
          .stop(true, true)
          .slideUp(200);
      });
    }

    // -----------------------------
    //  Testimonial Slider
    // -----------------------------
    $('.testimonial-slider').slick({
      slidesToShow: 2,
      infinite: true,
      arrows: false,
      autoplay: true,
      autoplaySpeed: 2000,
      dots: true,
      responsive: [
        {
          breakpoint: 991,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1
          }
        }
      ]
    });


    // -----------------------------
    //  Video Replace
    // -----------------------------
    $('.video-box i').click(function () {
      var video = '<iframe class="border-0" allowfullscreen src="' + $(this).attr('data-video') + '"></iframe>';
      $(this).replaceWith(video);
    });


    // -----------------------------
    //  Count Down JS
    // -----------------------------
    var syoTimer = $('#simple-timer');
    if (syoTimer) {
      $('#simple-timer').syotimer({
        year: 2023,
        month: 9,
        day: 1,
        hour: 0,
        minute: 0
      });
    }


    // -----------------------------
    //  Story Slider
    // -----------------------------
    $('.about-slider').slick({
      slidesToShow: 1,
      infinite: true,
      arrows: false,
      autoplay: true,
      autoplaySpeed: 2000,
      dots: true
    });


    // -----------------------------
    //  Quote Slider
    // -----------------------------
    $('.quote-slider').slick({
      slidesToShow: 1,
      infinite: true,
      arrows: false,
      autoplay: true,
      autoplaySpeed: 2000,
      dots: true
    });


    // -----------------------------
    //  Client Slider
    // -----------------------------
    $('.client-slider').slick({
      slidesToShow: 4,
      infinite: true,
      arrows: false,
      // autoplay: true,
      autoplaySpeed: 2000,
      dots: true,
      responsive: [
        {
          breakpoint: 0,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1
          }
        },
        {
          breakpoint: 575,
          settings: {
            slidesToShow: 2,
            slidesToScroll: 1
          }
        },
        {
          breakpoint: 767,
          settings: {
            slidesToShow: 2,
            slidesToScroll: 2
          }
        },
        {
          breakpoint: 991,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 2
          }
        }
      ]
    });


    // scroll
    // $('.scrollTo').on('click', function (e) {
    //   e.preventDefault();
    //   var target = $(this).attr('href');
    //   $('html, body').animate({
    //     scrollTop: ($(target).offset().top)
    //   }, 500);
    // });

  });

})(jQuery);
