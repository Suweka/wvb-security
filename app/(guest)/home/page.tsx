'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { RoomCard } from '@/components/guest/RoomCard';
import { QuickBookingWidget } from '@/components/guest/QuickBookingWidget';
import GoogleReviewsWidget from '@/components/GoogleReviewsWidget';
import { Reveal, Stagger } from '@/components/guest/Reveal';
import { CountUp } from '@/components/guest/CountUp';
import {
  Wifi,
  ChefHat,
  Trees,
  Droplets,
  Sofa,
  Flame,
  Speaker,
  Mountain,
  Tv,
  MapPin,
  Calendar,
  CheckCircle,
  Loader2,
  X,
  Star,
} from 'lucide-react';

export default function HomePage() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterPopup, setNewsletterPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterLoading(true);
    setNewsletterPopup(null);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok || res.status === 200) {
        setNewsletterPopup({ type: 'success', message: data.message || 'Thank you for subscribing!' });
        setNewsletterEmail('');
      } else {
        setNewsletterPopup({ type: 'error', message: data.error || 'Something went wrong. Please try again.' });
      }
    } catch {
      setNewsletterPopup({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setNewsletterLoading(false);
    }
  };

  // Mock data - replace with API calls
  const rooms = [
    {
      id: 'deluxe-room',
      name: 'Deluxe Rooms',
      description: 'Spacious rooms with stunning views of the tea plantations and modern amenities for a comfortable stay.',
      price: 15000,
      maxGuests: 2,
      size: 350,
      image: '/images/rooms/deluxe.jpeg',
      badge: 'Best Value',
    },
    {
      id: 'junior-suite',
      name: 'Junior Suites',
      description: 'Elegant suites featuring separate living areas and premium furnishings for an enhanced experience.',
      price: 22000,
      maxGuests: 3,
      size: 450,
      image: '/images/rooms/junior.jpeg',
    },
    {
      id: 'family-room',
      name: 'Family Rooms',
      description: 'Perfect for families with interconnected rooms and child-friendly amenities.',
      price: 28000,
      maxGuests: 4,
      size: 550,
      image: '/images/rooms/family.jpeg',
      badge: 'Family Pick',
    },
  ];

  const services = [
    { icon: ChefHat,  title: 'In-House Chef',            description: 'Enjoy freshly prepared home-style meals from our dedicated in-house chef' },
    { icon: Wifi,     title: 'Free WiFi',                 description: 'High-speed internet access throughout the entire property' },
    { icon: Trees,    title: 'Garden Space',              description: 'Lush private garden perfect for relaxing amid nature' },
    { icon: Droplets, title: 'Hot Water',                 description: 'Reliable hot water available in every room around the clock' },
    { icon: Sofa,     title: 'Living & Dining Rooms',     description: 'Spacious shared living room and elegant dining area for your comfort' },
    { icon: Flame,    title: 'Barbeque Grill',            description: 'Outdoor BBQ grill available for a fun evening cookout experience' },
    { icon: Speaker,  title: 'Bluetooth Mic & Speakers',  description: 'Entertainment-ready Bluetooth speakers and mic for gatherings' },
    { icon: Mountain, title: 'Picturesque Surroundings',  description: 'Breathtaking views of misty mountains and tea plantations at every turn' },
    { icon: Tv,       title: 'TV in Every Room',          description: 'Each room equipped with a television for your entertainment' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[640px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white overflow-hidden">
        {/* Cinematic slow-zoom background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 animate-kenburns"
          style={{ backgroundImage: 'url(/images/hero-bg.jpg)' }}
        />
        {/* Depth gradient so text always pops */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-gray-900/40" />

        <div className="relative z-10 text-center max-w-4xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-4 text-accent font-medium tracking-[0.35em] text-sm"
          >
            LUXURY HOTEL &amp; RESORT
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="text-5xl md:text-7xl font-heading font-bold mb-6"
          >
            White Vintage Bungalow
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="text-xl mb-8 text-gray-200"
          >
            Experience colonial elegance in the heart of Sri Lanka&apos;s hill country
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/booking">
              <Button variant="primary" size="lg" className="shadow-lg shadow-primary/40 hover:scale-105 transition-transform">
                Book Your Stay
              </Button>
            </Link>
            <Link href="/rooms">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-gray-900 backdrop-blur-sm bg-white/5 hover:scale-105 transition-all">
                Explore Rooms
              </Button>
            </Link>
          </motion.div>

          {/* Trust stats — animated counters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 1 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center"
          >
            <div>
              <div className="text-3xl font-heading font-bold text-white">
                <CountUp end={10} suffix="+" />
              </div>
              <div className="text-xs uppercase tracking-widest text-gray-300 mt-1">Years of Heritage</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-white/20" />
            <div>
              <div className="text-3xl font-heading font-bold text-white">
                <CountUp end={500} suffix="+" />
              </div>
              <div className="text-xs uppercase tracking-widest text-gray-300 mt-1">Happy Guests</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-white/20" />
            <div>
              <div className="text-3xl font-heading font-bold text-white flex items-center justify-center gap-1">
                <CountUp end={4.9} decimals={1} />
                <Star size={22} className="text-accent fill-accent" />
              </div>
              <div className="text-xs uppercase tracking-widest text-gray-300 mt-1">Google Rating</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Booking Section */}
      <section className="bg-white shadow-lg -mt-16 relative z-20 max-w-6xl mx-auto rounded-xl border border-gray-100">
        <QuickBookingWidget />
      </section>

      {/* About Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <Reveal direction="right">
              <div className="text-primary font-medium mb-2">ABOUT US</div>
              <h2 className="text-4xl font-heading font-bold mb-6">
                The Best Luxury Rooms And Suites
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                White Vintage Bungalow is a historic colonial-era property nestled in the
                picturesque hills of Nuwara Eliya. Built in the early 1900s, our bungalow
                has been carefully restored to preserve its original charm while incorporating
                modern luxury amenities.
              </p>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Surrounded by lush tea plantations and offering breathtaking views of the
                misty mountains, we provide an authentic Sri Lankan hill country experience
                with world-class hospitality.
              </p>
              <Link href="/about">
                <Button variant="primary" size="lg">
                  Learn More →
                </Button>
              </Link>
            </Reveal>
            <div className="grid grid-cols-2 gap-4">
              <Reveal delay={0.15} className="h-64 rounded-lg overflow-hidden group">
                <img
                  src="/images/about/about1.jpeg"
                  alt="White Vintage Bungalow interior"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </Reveal>
              <Reveal delay={0.3} className="h-64 rounded-lg overflow-hidden mt-8 group">
                <img
                  src="/images/about/about2.jpeg"
                  alt="Luxury suite"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2">ROOMS AND SUITES</div>
            <h2 className="text-4xl font-heading font-bold">The Best Luxury Rooms And Suites</h2>
          </Reveal>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" interval={0.12}>
            {rooms.map((room) => (
              <RoomCard key={room.id} {...room} />
            ))}
          </Stagger>
          <Reveal className="text-center mt-12">
            <Link href="/rooms">
              <Button variant="outline" size="lg">
                View All Rooms →
              </Button>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2">OUR SERVICES</div>
            <h2 className="text-4xl font-heading font-bold">Get The Best Hotel Services</h2>
          </Reveal>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" interval={0.08}>
            {services.map((service, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group h-full"
              >
                <div className="w-16 h-16 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <service.icon className="text-primary group-hover:text-white transition-colors" size={32} />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3">{service.title}</h3>
                <p className="text-gray-600">{service.description}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="container mx-auto">
          <Reveal className="relative h-[500px] rounded-lg overflow-hidden">
            <video
              src="/videos/intro.mp4"
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
            <div className="absolute bottom-8 left-8 right-8">
              <div className="text-accent font-medium tracking-[0.3em] text-xs mb-2">EXPERIENCE</div>
              <h3 className="text-2xl md:text-3xl font-heading font-bold">A Glimpse of Life at the Bungalow</h3>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonials — Google Reviews */}
      <section className="py-20 px-4 bg-primary-light">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2">TESTIMONIALS</div>
            <h2 className="text-4xl font-heading font-bold">What Our Guests Say on Google</h2>
          </Reveal>
          <Reveal delay={0.15}>
            <GoogleReviewsWidget />
          </Reveal>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <Reveal direction="right">
              <div className="text-primary font-medium mb-2">LOCATION</div>
              <h2 className="text-4xl font-heading font-bold mb-6">Visit Us in Nuwara Eliya</h2>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <MapPin className="text-primary mt-1 flex-shrink-0" size={24} />
                  <div>
                    <h4 className="font-semibold mb-1">Address</h4>
                    <p className="text-gray-600">78/5 Bakers Park, Dawson Hills, Nuwara Eliya</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="text-primary mt-1 flex-shrink-0" size={24} />
                  <div>
                    <h4 className="font-semibold mb-1">Nearby Attractions</h4>
                    <ul className="text-gray-600 space-y-1">
                      <li>• Gregory Lake - 2 km</li>
                      <li>• Hakgala Botanical Garden - 5 km</li>
                      <li>• Victoria Park - 3 km</li>
                    </ul>
                  </div>
                </div>
              </div>
              <a 
                href="https://www.google.com/maps/search/78%2F5+Bakers+Park,+Dawson+Hills,+Nuwara+Eliya/@6.942114,80.793866,15z" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="primary" size="lg">
                  Get Directions
                </Button>
              </a>
            </Reveal>
            <Reveal direction="left" delay={0.15} className="h-96 bg-gray-300 rounded-lg overflow-hidden relative shadow-lg">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.568038677998!2d80.79386617448296!3d6.942114618158248!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae38127c9b1b06d%3A0x98ebbcd4fa73d315!2sWhite%20Vintage%20Bungalow!5e0!3m2!1sen!2slk!4v1765016591928!5m2!1sen!2slk"
                className="w-full h-full"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-primary text-white py-16 px-4 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <Reveal className="container mx-auto text-center max-w-2xl relative">
          <h2 className="text-3xl font-heading font-bold mb-4">
            We Offer Every Month 20% Off for Our Subscribers
          </h2>
          <p className="text-white/80 mb-8">Subscribe to receive exclusive deals, seasonal offers, and updates straight to your inbox.</p>

          <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              value={newsletterEmail}
              onChange={e => setNewsletterEmail(e.target.value)}
              placeholder="Your email address"
              required
              disabled={newsletterLoading}
              className="flex-1 px-4 py-3 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-70"
            />
            <Button variant="secondary" size="lg" type="submit" disabled={newsletterLoading}>
              {newsletterLoading ? <Loader2 size={18} className="animate-spin" /> : 'Subscribe'}
            </Button>
          </form>
        </Reveal>

        {/* Success / Error Popup */}
        {newsletterPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setNewsletterPopup(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setNewsletterPopup(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

              {newsletterPopup.type === 'success' ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-green-500" size={36} />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-gray-900 mb-2">You&apos;re Subscribed!</h3>
                  <p className="text-gray-600 text-sm mb-1">{newsletterPopup.message}</p>
                  <p className="text-gray-500 text-sm">Check your inbox for a welcome email from White Vintage Bungalow.</p>
                  <button
                    onClick={() => setNewsletterPopup(null)}
                    className="mt-6 w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="text-red-500" size={36} />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-gray-900 mb-2">Oops!</h3>
                  <p className="text-gray-600 text-sm">{newsletterPopup.message}</p>
                  <button
                    onClick={() => setNewsletterPopup(null)}
                    className="mt-6 w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}