// Browser-side image registry — APP_IMAGES house standard
const APP_IMAGES = {
  brain_hero: "/images/brain-hero.png",
  texture_marble: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFyYmxlJTIwdGV4dHVyZXxlbnwwfHx8fDE3NzcyNTMzOTd8MA&ixlib=rb-4.1.0&q=85",
  texture_cathedral: "https://images.pexels.com/photos/33827030/pexels-photo-33827030.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  texture_forge: "https://images.unsplash.com/photo-1773401348019-629c2a92a871?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxnbG93aW5nJTIwZm9yZ2UlMjBlbWJlcnN8ZW58MHx8fHwxNzc3MjUzMzk3fDA&ixlib=rb-4.1.0&q=85",
  texture_parchment: "https://images.pexels.com/photos/5102226/pexels-photo-5102226.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  // The War Room's surface is a plotting grid rather than a photograph — drawn
  // inline so it needs no network and tiles cleanly at any size.
  texture_map:
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
         <g stroke='#D6C08A' stroke-width='0.4' opacity='0.45' fill='none'>
           <path d='M0 24H120M0 48H120M0 72H120M0 96H120'/>
           <path d='M24 0V120M48 0V120M72 0V120M96 0V120'/>
         </g>
         <g stroke='#D6C08A' stroke-width='0.9' opacity='0.75' fill='none'>
           <path d='M0 0H120M0 0V120'/>
         </g>
         <circle cx='0' cy='0' r='1.6' fill='#D6C08A' opacity='0.6'/>
       </svg>`.replace(/\s+/g, " ")
    ),
};

export function getImage(key) {
  return APP_IMAGES[key];
}

export function setImage(key, url) {
  APP_IMAGES[key] = url;
}

export function setAllImages(map) {
  Object.assign(APP_IMAGES, map);
}

export default APP_IMAGES;
