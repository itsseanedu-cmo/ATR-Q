export const MAX_HEADSHOT_LENGTH = 90000;

export function validateRating(value: unknown, required = false): string {
  const rating = String(value ?? '').trim();
  if (!rating && !required) return '';
  if (!/^([1-5])(\.\d{1,2})?\+?$/.test(rating)) {
    throw new Error('Enter a skill rating from 1.0 to 5.99.');
  }
  return rating;
}

export function validateHeadshot(value: unknown): string {
  const photo = String(value ?? '');
  if (!photo) return '';
  if (photo.length > MAX_HEADSHOT_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo)) {
    throw new Error('Upload a headshot using the photo picker.');
  }
  return photo;
}
