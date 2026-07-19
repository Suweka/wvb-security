// This is the public "About Us" page for the guest-facing site.
// It's a Next.js Client Component (see 'use client' below) that renders static
// marketing content: hero banner, stats, our story, values, team, and a call-to-action.
// All the data on this page (stats, team members, etc.) is hard-coded in arrays below —
// there is no API call or database fetch on this page.

// 'use client' tells Next.js this component runs in the user's browser, not on the
// server. It's required here because we use browser-only features like framer-motion
// animations (motion.div) and React hooks used inside the Reveal/CountUp components.
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Reveal, Stagger } from '@/components/guest/Reveal';
import { CountUp } from '@/components/guest/CountUp';
import { Award, Users, Heart, Shield, Star, CheckCircle, Sparkles } from 'lucide-react';

// The default export is what Next.js renders for the /about route.
export default function AboutPage() {
  // Hard-coded stats shown as animated counters (see CountUp) in the "Stats" section below.
  const stats = [
    { end: 10,  suffix: '+', decimals: 0, label: 'Years of Hospitality' },
    { end: 500, suffix: '+', decimals: 0, label: 'Happy Guests' },
    { end: 4,   suffix: '',  decimals: 0, label: 'Rooms & Suites' },
    { end: 4.9, suffix: '',  decimals: 1, label: 'Google Rating' },
  ];

  // Core values displayed as cards in the "Our Values" section.
  const values = [
    {
      icon: Heart,
      title: 'Hospitality',
      description: 'We treat every guest like family, ensuring comfort and care throughout your stay.',
    },
    {
      icon: Shield,
      title: 'Vintage Charm',
      description: 'Timeless vintage character and cosy interiors paired with modern comfort and convenience.',
    },
    {
      icon: Star,
      title: 'Excellence',
      description: 'Committed to delivering exceptional service and unforgettable experiences.',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Supporting local businesses and creating sustainable tourism practices.',
    },
  ];

  // Team member cards shown in the "Our Team" section.
  const team = [
    { name: 'Lalith Prasanna', position: 'Owner', image: '/images/team/1.jpeg' },
    { name: 'Maduri Hansika', position: 'Manager', image: '/images/team/2.jpeg' },
    { name: 'Nilanga Perera', position: 'Head Chef', image: '/images/team/3.jpg' },
    { name: 'Suweka Jayakody', position: 'IT Manager', image: '/images/team/4.jpeg' },
  ];

  // "Guest Favourites" highlight cards.
  const highlights = [
    { title: 'Home-Style Dining', org: 'Fresh meals prepared by our in-house chef' },
    { title: 'Garden & Barbeque Evenings', org: 'Private garden with an outdoor BBQ grill' },
    { title: 'Tea-Country Views', org: 'Misty mountains and plantations at every turn' },
  ];

  // Bullet-point reasons shown in the "Why Choose Us" section.
  const reasons = [
    'Charming vintage-style bungalow',
    'Prime location in Nuwara Eliya',
    'Personalized, family-run service',
    'Modern comforts in every room',
    'Stunning mountain views',
    '4.9★ rated by guests on Google',
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 animate-fadeIn">
      {/* Hero Section */}
      <section className="relative isolate h-[560px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white overflow-hidden">
        <Image
          src="/images/hero-bg.jpg"
          alt="White Vintage Bungalow"
          fill
          priority
          className="object-cover opacity-40 animate-kenburns"
        />
        <div className="absolute top-10 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-accent/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles size={14} className="text-accent" />
              Nuwara Eliya, Sri Lanka
            </div>
            <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4">About Us</h1>
            <p className="text-xl text-gray-200">
              Vintage Charm &amp; Warm Hospitality in Sri Lanka&apos;s Hill Country
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-primary to-primary-dark text-white py-14">
        <div className="absolute -top-20 left-1/4 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  <CountUp end={stat.end} suffix={stat.suffix} decimals={stat.decimals} />
                </div>
                <div className="text-gray-200">{stat.label}</div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <Reveal direction="right">
              <div className="text-primary font-medium mb-2 tracking-wide">OUR STORY</div>
              <h2 className="text-4xl font-heading font-bold mb-6">
                A Home Away From Home in the Hills
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                White Vintage Bungalow is a family-run guest bungalow nestled in the
                misty hills of Nuwara Eliya. Styled with timeless vintage character —
                white facades, cosy interiors, and a lush private garden — it offers a
                warm, personal alternative to the big hotels.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                For more than a decade we&apos;ve welcomed travellers from Sri Lanka and
                around the world, treating every guest like family. Home-style meals from
                our in-house chef, evenings around the barbeque, and mornings with
                mountain and tea-country views are what our guests remember most.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                Whether you&apos;re here for Gregory Lake, the tea trails, or simply the
                cool hill-country air, our team makes sure your stay feels effortless
                from check-in to farewell.
              </p>
              <Link href="/rooms">
                <Button variant="primary" size="lg">
                  Discover Our Rooms
                </Button>
              </Link>
            </Reveal>
            <Reveal direction="left" delay={0.15}>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg overflow-hidden shadow-lg hover-lift">
                  <Image
                    src="/images/about/about1.jpeg"
                    alt="White Vintage Bungalow Interior"
                    width={400}
                    height={300}
                    className="object-cover h-64 w-full"
                  />
                </div>
                <div className="rounded-lg overflow-hidden shadow-lg hover-lift mt-8">
                  <Image
                    src="/images/about/about2.jpeg"
                    alt="White Vintage Bungalow Exterior"
                    width={400}
                    height={300}
                    className="object-cover h-64 w-full"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2 tracking-wide">OUR VALUES</div>
            <h2 className="text-4xl font-heading font-bold">What We Stand For</h2>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="glass-card glow-primary hover-lift rounded-2xl p-8 text-center group"
              >
                <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <value.icon className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2 tracking-wide">OUR TEAM</div>
            <h2 className="text-4xl font-heading font-bold">Meet the People Behind Our Service</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Our dedicated team is committed to making your stay memorable
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <div key={member.name} className="glass-card glow-primary hover-lift rounded-2xl overflow-hidden group">
                <div className="overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={300}
                    height={256}
                    className="w-full h-64 object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                </div>
                <div className="p-6 text-center">
                  <h3 className="text-xl font-heading font-semibold mb-1">{member.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{member.position}</p>
                </div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Guest Favourites */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="text-primary font-medium mb-2 tracking-wide">GUEST FAVOURITES</div>
            <h2 className="text-4xl font-heading font-bold">What Guests Love Most</h2>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="glass-card glow-primary hover-lift rounded-2xl text-center p-8 group">
                <Award className="text-primary mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" size={48} />
                <h3 className="text-lg font-semibold mb-2">{highlight.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{highlight.org}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="relative isolate overflow-hidden py-20 px-4 bg-gradient-to-r from-primary to-primary-dark text-white">
        <div className="absolute -bottom-24 -right-16 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />
        <div className="container mx-auto relative">
          <Reveal className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">Why Choose White Vintage Bungalow?</h2>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reasons.map((reason) => (
              <div key={reason} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 hover:bg-white/15 transition-colors">
                <CheckCircle size={24} className="text-accent flex-shrink-0" />
                <span className="text-lg">{reason}</span>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="relative isolate overflow-hidden py-20 px-4">
        <div className="absolute -top-16 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <Reveal className="container mx-auto text-center relative">
          <h2 className="text-3xl font-heading font-bold mb-4">Experience the White Vintage Charm</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Book your stay and see why our guests keep coming back
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/booking">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Book Your Stay
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Contact Us
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
