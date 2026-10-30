"""Opaque limbs crossing an opaque torso must be protected, not crossfaded."""
import unittest
import numpy as np
import cv2
from pet_motion_confidence import material_confidence

class ConfidenceTests(unittest.TestCase):
    def test_opaque_paw_over_opaque_chest(self):
        a=np.full((96,96,3),220,dtype='float32');b=a.copy()
        a[32:48,28:44]=40;b[48:64,28:44]=40
        alpha=np.full((96,96),255,dtype='uint8');flow=np.zeros((96,96,2),dtype='float32')
        confidence=material_confidence(a,b,alpha,alpha,cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),flow)
        self.assertEqual(int(confidence[36,36]),0)
        self.assertEqual(int(confidence[60,36]),0)
        self.assertEqual(int(confidence[80,80]),255)
    def test_matched_body_material_remains_continuous(self):
        a=np.full((96,96,3),180,dtype='float32');b=a+5
        alpha=np.full((96,96),255,dtype='uint8');flow=np.zeros((96,96,2),dtype='float32')
        confidence=material_confidence(a,b,alpha,alpha,cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),flow)
        self.assertEqual(int(confidence[48,48]),255)

if __name__=='__main__':unittest.main()
