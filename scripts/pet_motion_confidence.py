"""Confidence that two motion-aligned pixels belong to the same visible surface."""
import cv2
import numpy as np


def material_confidence(first_rgb, second_rgb, first_alpha, second_alpha, first_gray, field):
    height,width=first_gray.shape
    yy,xx=np.mgrid[:height,:width].astype('float32')
    # Alpha alone cannot detect an opaque paw crossing an opaque chest.
    # Reject material mixing around mismatched interior edges and disocclusions.
    sx=xx+field[:,:,0];sy=yy+field[:,:,1]
    matched=cv2.remap(second_rgb,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    matched_alpha=cv2.remap(second_alpha,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    error=np.max(np.abs(cv2.GaussianBlur(first_rgb,(0,0),2)-cv2.GaussianBlur(matched,(0,0),2)),axis=2)
    edge_a=cv2.Laplacian(cv2.GaussianBlur(first_gray.astype('float32'),(0,0),2),cv2.CV_32F,ksize=3)
    gray_b=cv2.cvtColor(matched.astype('uint8'),cv2.COLOR_RGB2GRAY).astype('float32')
    edge_b=cv2.Laplacian(cv2.GaussianBlur(gray_b,(0,0),2),cv2.CV_32F,ksize=3)
    unsafe=(error>22)|(np.abs(edge_a-edge_b)>7)|(np.abs(first_alpha.astype('float32')-matched_alpha)>32)
    unsafe=cv2.dilate(unsafe.astype('uint8'),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
    unsafe=cv2.GaussianBlur(unsafe.astype('float32'),(0,0),1.5)
    return np.rint((1-np.clip(unsafe*2,0,1))*255).astype('uint8')
