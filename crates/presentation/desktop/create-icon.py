from PIL import Image, ImageDraw
import os

# Create a simple icon
img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw a simple circle
draw.ellipse([100, 100, 924, 924], fill=(50, 100, 200, 255))
draw.ellipse([200, 200, 824, 824], fill=(100, 150, 250, 255))

# Save as PNG
img.save('app-icon.png')
print("Icon created successfully")
