// Browser-side image registry — APP_IMAGES house standard
const APP_IMAGES = {
  brain_hero: "https://customer-assets.emergentagent.com/job_judicial-mind/artifacts/sl2owgjo_image.png",
  texture_marble: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFyYmxlJTIwdGV4dHVyZXxlbnwwfHx8fDE3NzcyNTMzOTd8MA&ixlib=rb-4.1.0&q=85",
  texture_cathedral: "https://images.pexels.com/photos/33827030/pexels-photo-33827030.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  texture_forge: "https://images.unsplash.com/photo-1773401348019-629c2a92a871?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxnbG93aW5nJTIwZm9yZ2UlMjBlbWJlcnN8ZW58MHx8fHwxNzc3MjUzMzk3fDA&ixlib=rb-4.1.0&q=85",
  texture_parchment: "https://images.pexels.com/photos/5102226/pexels-photo-5102226.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
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
