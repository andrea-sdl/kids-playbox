"""Check the shipped discovery artwork with Pillow: python3 tests/forest_art_test.py."""

from pathlib import Path
import unittest

from PIL import Image


OBJECTS = Path(__file__).resolve().parents[1] / "games/forest/art/objects"

# Rectangles cover scenery which remains visible in every drawing. Coordinates
# use a 200 by 160 reference frame so they also work at a different resolution.
SCENERY = {
    "bell": [(28, 78, 45, 96), (124, 117, 142, 147)],
    "boat": [(23, 64, 56, 75), (123, 113, 169, 145)],
    "carp": [(94, 95, 114, 109), (176, 21, 194, 49)],
    "coin1": [(37, 68, 49, 104), (120, 111, 167, 141)],
    "coin2": [(59, 48, 75, 71), (46, 101, 56, 133)],
    "coin3": [(40, 80, 50, 107), (22, 39, 43, 61)],
    "float": [(48, 67, 67, 99), (139, 78, 162, 109)],
    "fox": [(77, 43, 100, 66), (140, 106, 168, 129)],
    "letter": [(67, 75, 80, 104), (107, 106, 130, 125)],
    "map": [(48, 72, 88, 90), (46, 120, 62, 145)],
    "moth": [(8, 121, 42, 141), (184, 126, 196, 151)],
    # Stream, bark, flowers, shelf mushroom, and moss below the perch.
    "owl": [(14, 84, 50, 114), (87, 18, 117, 35), (150, 101, 190, 136),
            (163, 35, 173, 39), (71, 119, 124, 146)],
    "pods": [(28, 51, 41, 65), (139, 65, 164, 83)],
    "quilt": [(39, 114, 47, 126), (81, 123, 124, 141)],
    "scope": [(29, 40, 44, 93), (60, 104, 84, 120)],
    "ship": [(5, 68, 17, 110), (77, 130, 147, 149)],
    "signal": [(5, 24, 25, 42), (97, 61, 142, 105)],
    "song": [(65, 55, 102, 74), (110, 117, 135, 132)],
    "stairs": [(72, 45, 92, 60), (147, 88, 181, 105)],
    "stars": [(23, 62, 37, 101), (87, 122, 120, 130)],
    "tea": [(76, 55, 92, 86), (108, 34, 122, 46)],
    "tree": [(79, 45, 87, 53), (78, 108, 91, 126)],
}


class DiscoveryArtTest(unittest.TestCase):
    def test_poses_leave_the_scenery_transparent(self):
        cards = {p.name.removesuffix("-poses.webp") for p in OBJECTS.glob("*-poses.webp")}
        self.assertEqual(cards, set(SCENERY))
        for card, regions in SCENERY.items():
            with self.subTest(card=card):
                with Image.open(OBJECTS / f"{card}-ground.webp") as plate:
                    self.assertEqual(plate.n_frames, 1)
                    width, height = plate.size
                with Image.open(OBJECTS / f"{card}-poses.webp") as poses:
                    self.assertEqual(poses.size, (3 * width, 2 * height))
                    alpha = poses.getchannel("A")
                for pose in range(6):
                    x = (pose % 3) * width
                    y = (pose // 3) * height
                    for left, top, right, bottom in regions:
                        box = (x + round(left * width / 200), y + round(top * height / 160),
                               x + round(right * width / 200), y + round(bottom * height / 160))
                        self.assertIsNone(alpha.crop(box).getbbox(),
                                          f"{card} pose {pose} paints over scenery at {box}")


if __name__ == "__main__":
    unittest.main()
