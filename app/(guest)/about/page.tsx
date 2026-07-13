'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Award, Users, Heart, Shield, Star, CheckCircle } from 'lucide-react';

export default function AboutPage() {
  const stats = [
    { number: '10+', label: 'Years of Hospitality' },
    { number: '500+', label: 'Happy Guests' },
    { number: '4', label: 'Rooms & Suites' },
    { number: '4.9', label: 'Google Rating' },
  ];

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

  const team = [
    { name: 'Lalith Prasanna', position: 'Owner', image: '/images/team/1.jpeg' },
    { name: 'Maduri Hansika', position: 'Manager', image: '/images/team/2.jpeg' },
    { name: 'Nilanga Perera', position: 'Head Chef', image: '/images/team/3.jpg' },
    { name: 'Suweka Jayakody', position: 'IT Manager', image: '/images/team/4.jpeg' },
  ];

  return (
    <div className="min-h-screen bg-white animate-fadeIn">
      {/* Hero Section */}
      <section className="relative h-[500px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white overflow-hidden">
        <Image
          src="/images/hero-bg.jpg"
          alt="White Vintage Bungalow"
          fill
          className="object-cover opacity-40"
        />
        <div className="relative z-10 text-center max-w-4xl px-4">
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4">About Us</h1>
          <p className="text-xl text-gray-200">
            Vintage Charm &amp; Warm Hospitality in Sri Lanka&apos;s Hill Country
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">{stat.number}</div>
                <div className="text-gray-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-primary font-medium mb-2">OUR STORY</div>
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
              <Button variant="primary" size="lg">
                Discover Our Rooms
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Image
                src="/images/about/about1.jpeg"
                alt="White Vintage Bungalow Interior"
                width={400}
                height={300}
                className="rounded-lg object-cover h-64 w-full"
              />
              <Image
                src="/images/about/about2.jpeg"
                alt="White Vintage Bungalow Exterior"
                width={400}
                height={300}
                className="rounded-lg object-cover h-64 w-full mt-8"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="text-primary font-medium mb-2">OUR VALUES</div>
            <h2 className="text-4xl font-heading font-bold">What We Stand For</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white p-8 rounded-lg shadow-md text-center">
                <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="text-primary font-medium mb-2">OUR TEAM</div>
            <h2 className="text-4xl font-heading font-bold">Meet the People Behind Our Service</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Our dedicated team is committed to making your stay memorable
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="glass-card hover-lift rounded-2xl overflow-hidden">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={300}
                  height={256}
                  className="w-full h-64 object-cover"
                />
                <div className="p-6 text-center">
                  <h3 className="text-xl font-heading font-semibold mb-1">{member.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{member.position}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guest Favourites */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="text-primary font-medium mb-2">GUEST FAVOURITES</div>
            <h2 className="text-4xl font-heading font-bold">What Guests Love Most</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: 'Home-Style Dining',
                org: 'Fresh meals prepared by our in-house chef',
              },
              {
                title: 'Garden & Barbeque Evenings',
                org: 'Private garden with an outdoor BBQ grill',
              },
              {
                title: 'Tea-Country Views',
                org: 'Misty mountains and plantations at every turn',
              },
            ].map((highlight, index) => (
              <div key={index} className="text-center p-6 bg-primary-light rounded-lg">
                <Award className="text-primary mx-auto mb-4" size={48} />
                <h3 className="text-lg font-semibold mb-2">{highlight.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{highlight.org}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-4 bg-primary text-white">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">Why Choose White Vintage Bungalow?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              'Charming vintage-style bungalow',
              'Prime location in Nuwara Eliya',
              'Personalized, family-run service',
              'Modern comforts in every room',
              'Stunning mountain views',
              '4.9★ rated by guests on Google',
            ].map((reason: string, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle size={24} className="text-accent flex-shrink-0" />
                <span className="text-lg">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-heading font-bold mb-4">Experience the White Vintage Charm</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Book your stay and see why our guests keep coming back
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg">
              Book Your Stay
            </Button>
            <Button variant="outline" size="lg">
              Contact Us
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}