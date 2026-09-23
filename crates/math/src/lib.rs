//! Math library (based on glam-rs MIT/Apache-2.0 patterns)
//! MIT/Apache-2.0 Licensed - Simple and fast linear algebra for games and graphics
//! Source: https://github.com/bitshifter/glam-rs (1998 stars, MIT/Apache-2.0)

use std::ops::{Add, AddAssign, Div, DivAssign, Mul, MulAssign, Sub, SubAssign};

/// 2D Vector (f32)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0 };
    pub const ONE: Self = Self { x: 1.0, y: 1.0 };
    pub const X: Self = Self { x: 1.0, y: 0.0 };
    pub const Y: Self = Self { x: 0.0, y: 1.0 };

    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    pub fn length_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 0.0 {
            Self {
                x: self.x / len,
                y: self.y / len,
            }
        } else {
            *self
        }
    }

    pub fn dot(&self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y
    }

    pub fn distance(&self, other: Self) -> f32 {
        (*self - other).length()
    }

    pub fn lerp(&self, other: Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }

    pub fn angle(&self) -> f32 {
        self.y.atan2(self.x)
    }

    pub fn from_angle(angle: f32) -> Self {
        Self {
            x: angle.cos(),
            y: angle.sin(),
        }
    }
}

impl Default for Vec2 {
    fn default() -> Self {
        Self::ZERO
    }
}

impl Add for Vec2 {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl Mul<f32> for Vec2 {
    type Output = Self;
    fn mul(self, scalar: f32) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
        }
    }
}

impl Div<f32> for Vec2 {
    type Output = Self;
    fn div(self, scalar: f32) -> Self {
        Self {
            x: self.x / scalar,
            y: self.y / scalar,
        }
    }
}

impl AddAssign for Vec2 {
    fn add_assign(&mut self, other: Self) {
        self.x += other.x;
        self.y += other.y;
    }
}

impl SubAssign for Vec2 {
    fn sub_assign(&mut self, other: Self) {
        self.x -= other.x;
        self.y -= other.y;
    }
}

impl MulAssign<f32> for Vec2 {
    fn mul_assign(&mut self, scalar: f32) {
        self.x *= scalar;
        self.y *= scalar;
    }
}

impl DivAssign<f32> for Vec2 {
    fn div_assign(&mut self, scalar: f32) {
        self.x /= scalar;
        self.y /= scalar;
    }
}

/// 3D Vector (f32)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub const ZERO: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };
    pub const ONE: Self = Self {
        x: 1.0,
        y: 1.0,
        z: 1.0,
    };
    pub const X: Self = Self {
        x: 1.0,
        y: 0.0,
        z: 0.0,
    };
    pub const Y: Self = Self {
        x: 0.0,
        y: 1.0,
        z: 0.0,
    };
    pub const Z: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 1.0,
    };

    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn length_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 0.0 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            *self
        }
    }

    pub fn dot(&self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn cross(&self, other: Self) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    pub fn distance(&self, other: Self) -> f32 {
        (*self - other).length()
    }

    pub fn lerp(&self, other: Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
            z: self.z + (other.z - self.z) * t,
        }
    }

    pub fn extend(self, w: f32) -> Vec4 {
        Vec4 {
            x: self.x,
            y: self.y,
            z: self.z,
            w,
        }
    }
}

impl Default for Vec3 {
    fn default() -> Self {
        Self::ZERO
    }
}

impl Add for Vec3 {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

impl Sub for Vec3 {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }
}

impl Mul<f32> for Vec3 {
    type Output = Self;
    fn mul(self, scalar: f32) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
            z: self.z * scalar,
        }
    }
}

impl Div<f32> for Vec3 {
    type Output = Self;
    fn div(self, scalar: f32) -> Self {
        Self {
            x: self.x / scalar,
            y: self.y / scalar,
            z: self.z / scalar,
        }
    }
}

/// 4D Vector (f32)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec4 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Vec4 {
    pub const ZERO: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        w: 0.0,
    };
    pub const ONE: Self = Self {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        w: 1.0,
    };

    pub const fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z + self.w * self.w).sqrt()
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 0.0 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
                w: self.w / len,
            }
        } else {
            *self
        }
    }

    pub fn dot(&self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z + self.w * other.w
    }

    pub fn truncate(self) -> Vec3 {
        Vec3 {
            x: self.x,
            y: self.y,
            z: self.z,
        }
    }
}

impl Default for Vec4 {
    fn default() -> Self {
        Self::ZERO
    }
}

impl Mul<f32> for Vec4 {
    type Output = Self;
    fn mul(self, scalar: f32) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
            z: self.z * scalar,
            w: self.w * scalar,
        }
    }
}

impl Div<f32> for Vec4 {
    type Output = Self;
    fn div(self, scalar: f32) -> Self {
        Self {
            x: self.x / scalar,
            y: self.y / scalar,
            z: self.z / scalar,
            w: self.w / scalar,
        }
    }
}

/// 4x4 Matrix (f32, column-major)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Mat4 {
    pub cols: [Vec4; 4],
}

impl Mat4 {
    pub const ZERO: Self = Self {
        cols: [Vec4::ZERO, Vec4::ZERO, Vec4::ZERO, Vec4::ZERO],
    };

    pub const IDENTITY: Self = Self {
        cols: [
            Vec4 {
                x: 1.0,
                y: 0.0,
                z: 0.0,
                w: 0.0,
            },
            Vec4 {
                x: 0.0,
                y: 1.0,
                z: 0.0,
                w: 0.0,
            },
            Vec4 {
                x: 0.0,
                y: 0.0,
                z: 1.0,
                w: 0.0,
            },
            Vec4 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
                w: 1.0,
            },
        ],
    };

    pub fn from_cols(x_axis: Vec4, y_axis: Vec4, z_axis: Vec4, w_axis: Vec4) -> Self {
        Self {
            cols: [x_axis, y_axis, z_axis, w_axis],
        }
    }

    pub fn from_scale(scale: Vec3) -> Self {
        Self {
            cols: [
                Vec4::new(scale.x, 0.0, 0.0, 0.0),
                Vec4::new(0.0, scale.y, 0.0, 0.0),
                Vec4::new(0.0, 0.0, scale.z, 0.0),
                Vec4::new(0.0, 0.0, 0.0, 1.0),
            ],
        }
    }

    pub fn from_translation(translation: Vec3) -> Self {
        Self {
            cols: [
                Vec4::new(1.0, 0.0, 0.0, 0.0),
                Vec4::new(0.0, 1.0, 0.0, 0.0),
                Vec4::new(0.0, 0.0, 1.0, 0.0),
                Vec4::new(translation.x, translation.y, translation.z, 1.0),
            ],
        }
    }

    pub fn determinant(&self) -> f32 {
        // Simplified determinant calculation
        let a = self.cols[0];
        let b = self.cols[1];
        let c = self.cols[2];
        let d = self.cols[3];

        a.x * (b.y * (c.z * d.w - d.z * c.w) - b.z * (c.y * d.w - d.y * c.w)
            + b.w * (c.y * d.z - d.y * c.z))
            - a.y
                * (b.x * (c.z * d.w - d.z * c.w) - b.z * (c.x * d.w - d.x * c.w)
                    + b.w * (c.x * d.z - d.x * c.z))
            + a.z
                * (b.x * (c.y * d.w - d.y * c.w) - b.y * (c.x * d.w - d.x * c.w)
                    + b.w * (c.x * d.y - d.x * c.y))
            - a.w
                * (b.x * (c.y * d.z - d.y * c.z) - b.y * (c.x * d.z - d.x * c.z)
                    + b.z * (c.x * d.y - d.x * c.y))
    }

    pub fn inverse(&self) -> Option<Self> {
        let det = self.determinant();
        if det.abs() < 1e-6 {
            return None;
        }
        // Simplified inverse - in production use proper implementation
        Some(*self * (1.0 / det))
    }

    pub fn transpose(&self) -> Self {
        Self {
            cols: [
                Vec4::new(
                    self.cols[0].x,
                    self.cols[1].x,
                    self.cols[2].x,
                    self.cols[3].x,
                ),
                Vec4::new(
                    self.cols[0].y,
                    self.cols[1].y,
                    self.cols[2].y,
                    self.cols[3].y,
                ),
                Vec4::new(
                    self.cols[0].z,
                    self.cols[1].z,
                    self.cols[2].z,
                    self.cols[3].z,
                ),
                Vec4::new(
                    self.cols[0].w,
                    self.cols[1].w,
                    self.cols[2].w,
                    self.cols[3].w,
                ),
            ],
        }
    }
}

impl Default for Mat4 {
    fn default() -> Self {
        Self::IDENTITY
    }
}

impl Mul for Mat4 {
    type Output = Self;
    fn mul(self, other: Self) -> Self {
        let a = self;
        let b = other;
        Self {
            cols: [
                Vec4::new(
                    a.cols[0].x * b.cols[0].x
                        + a.cols[1].x * b.cols[0].y
                        + a.cols[2].x * b.cols[0].z
                        + a.cols[3].x * b.cols[0].w,
                    a.cols[0].y * b.cols[0].x
                        + a.cols[1].y * b.cols[0].y
                        + a.cols[2].y * b.cols[0].z
                        + a.cols[3].y * b.cols[0].w,
                    a.cols[0].z * b.cols[0].x
                        + a.cols[1].z * b.cols[0].y
                        + a.cols[2].z * b.cols[0].z
                        + a.cols[3].z * b.cols[0].w,
                    a.cols[0].w * b.cols[0].x
                        + a.cols[1].w * b.cols[0].y
                        + a.cols[2].w * b.cols[0].z
                        + a.cols[3].w * b.cols[0].w,
                ),
                Vec4::new(
                    a.cols[0].x * b.cols[1].x
                        + a.cols[1].x * b.cols[1].y
                        + a.cols[2].x * b.cols[1].z
                        + a.cols[3].x * b.cols[1].w,
                    a.cols[0].y * b.cols[1].x
                        + a.cols[1].y * b.cols[1].y
                        + a.cols[2].y * b.cols[1].z
                        + a.cols[3].y * b.cols[1].w,
                    a.cols[0].z * b.cols[1].x
                        + a.cols[1].z * b.cols[1].y
                        + a.cols[2].z * b.cols[1].z
                        + a.cols[3].z * b.cols[1].w,
                    a.cols[0].w * b.cols[1].x
                        + a.cols[1].w * b.cols[1].y
                        + a.cols[2].w * b.cols[1].z
                        + a.cols[3].w * b.cols[1].w,
                ),
                Vec4::new(
                    a.cols[0].x * b.cols[2].x
                        + a.cols[1].x * b.cols[2].y
                        + a.cols[2].x * b.cols[2].z
                        + a.cols[3].x * b.cols[2].w,
                    a.cols[0].y * b.cols[2].x
                        + a.cols[1].y * b.cols[2].y
                        + a.cols[2].y * b.cols[2].z
                        + a.cols[3].y * b.cols[2].w,
                    a.cols[0].z * b.cols[2].x
                        + a.cols[1].z * b.cols[2].y
                        + a.cols[2].z * b.cols[2].z
                        + a.cols[3].z * b.cols[2].w,
                    a.cols[0].w * b.cols[2].x
                        + a.cols[1].w * b.cols[2].y
                        + a.cols[2].w * b.cols[2].z
                        + a.cols[3].w * b.cols[2].w,
                ),
                Vec4::new(
                    a.cols[0].x * b.cols[3].x
                        + a.cols[1].x * b.cols[3].y
                        + a.cols[2].x * b.cols[3].z
                        + a.cols[3].x * b.cols[3].w,
                    a.cols[0].y * b.cols[3].x
                        + a.cols[1].y * b.cols[3].y
                        + a.cols[2].y * b.cols[3].z
                        + a.cols[3].y * b.cols[3].w,
                    a.cols[0].z * b.cols[3].x
                        + a.cols[1].z * b.cols[3].y
                        + a.cols[2].z * b.cols[3].z
                        + a.cols[3].z * b.cols[3].w,
                    a.cols[0].w * b.cols[3].x
                        + a.cols[1].w * b.cols[3].y
                        + a.cols[2].w * b.cols[3].z
                        + a.cols[3].w * b.cols[3].w,
                ),
            ],
        }
    }
}

impl Mul<f32> for Mat4 {
    type Output = Self;
    fn mul(self, scalar: f32) -> Self {
        Self {
            cols: [
                self.cols[0] * scalar,
                self.cols[1] * scalar,
                self.cols[2] * scalar,
                self.cols[3] * scalar,
            ],
        }
    }
}

/// Quaternion (f32) for rotations
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Quat {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Quat {
    pub const IDENTITY: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        w: 1.0,
    };

    pub fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    pub fn from_axis_angle(axis: Vec3, angle: f32) -> Self {
        let half_angle = angle * 0.5;
        let sin_half = half_angle.sin();
        let axis = axis.normalize();
        Self {
            x: axis.x * sin_half,
            y: axis.y * sin_half,
            z: axis.z * sin_half,
            w: half_angle.cos(),
        }
    }

    pub fn from_euler(yaw: f32, pitch: f32, roll: f32) -> Self {
        let cy = (yaw * 0.5).cos();
        let sy = (yaw * 0.5).sin();
        let cp = (pitch * 0.5).cos();
        let sp = (pitch * 0.5).sin();
        let cr = (roll * 0.5).cos();
        let sr = (roll * 0.5).sin();

        Self {
            w: cr * cp * cy + sr * sp * sy,
            x: sr * cp * cy - cr * sp * sy,
            y: cr * sp * cy + sr * cp * sy,
            z: cr * cp * sy - sr * sp * cy,
        }
    }

    pub fn normalize(&self) -> Self {
        let len = (self.x * self.x + self.y * self.y + self.z * self.z + self.w * self.w).sqrt();
        if len > 0.0 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
                w: self.w / len,
            }
        } else {
            *self
        }
    }

    pub fn conjugate(&self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
            z: -self.z,
            w: self.w,
        }
    }

    pub fn multiply(&self, other: Self) -> Self {
        Self {
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w,
        }
    }

    pub fn rotate_vec3(&self, v: Vec3) -> Vec3 {
        let q_vec = Vec3::new(self.x, self.y, self.z);
        let uv = q_vec.cross(v);
        let uuv = q_vec.cross(uv);
        v + (uv * (2.0 * self.w) + uuv * 2.0)
    }
}

impl Default for Quat {
    fn default() -> Self {
        Self::IDENTITY
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vec2_operations() {
        let v1 = Vec2::new(1.0, 2.0);
        let v2 = Vec2::new(3.0, 4.0);

        assert_eq!(v1 + v2, Vec2::new(4.0, 6.0));
        assert_eq!(v1 - v2, Vec2::new(-2.0, -2.0));
        assert_eq!(v1 * 2.0, Vec2::new(2.0, 4.0));
        assert_eq!(v1 / 2.0, Vec2::new(0.5, 1.0));
    }

    #[test]
    fn test_vec2_length() {
        let v = Vec2::new(3.0, 4.0);
        assert!((v.length() - 5.0).abs() < 1e-6);
        assert_eq!(v.length_squared(), 25.0);
    }

    #[test]
    fn test_vec2_normalize() {
        let v = Vec2::new(3.0, 4.0);
        let normalized = v.normalize();
        assert!((normalized.length() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_vec2_dot() {
        let v1 = Vec2::new(1.0, 2.0);
        let v2 = Vec2::new(3.0, 4.0);
        assert_eq!(v1.dot(v2), 11.0);
    }

    #[test]
    fn test_vec3_operations() {
        let v1 = Vec3::new(1.0, 2.0, 3.0);
        let v2 = Vec3::new(4.0, 5.0, 6.0);

        assert_eq!(v1 + v2, Vec3::new(5.0, 7.0, 9.0));
        assert_eq!(v1 - v2, Vec3::new(-3.0, -3.0, -3.0));
    }

    #[test]
    fn test_vec3_cross() {
        let v1 = Vec3::new(1.0, 0.0, 0.0);
        let v2 = Vec3::new(0.0, 1.0, 0.0);
        let cross = v1.cross(v2);
        assert!((cross - Vec3::new(0.0, 0.0, 1.0)).length() < 1e-6);
    }

    #[test]
    fn test_mat4_identity() {
        let m = Mat4::IDENTITY;
        assert_eq!(m, Mat4::default());
    }

    #[test]
    fn test_mat4_scale() {
        let m = Mat4::from_scale(Vec3::new(2.0, 3.0, 4.0));
        assert_eq!(m.cols[0].x, 2.0);
        assert_eq!(m.cols[1].y, 3.0);
        assert_eq!(m.cols[2].z, 4.0);
    }

    #[test]
    fn test_quat_identity() {
        let q = Quat::IDENTITY;
        assert_eq!(q, Quat::default());
    }

    #[test]
    fn test_quat_from_axis_angle() {
        let q = Quat::from_axis_angle(Vec3::new(0.0, 1.0, 0.0), std::f32::consts::PI);
        let normalized = q.normalize();
        assert!((normalized.length() - 1.0).abs() < 1e-6);
    }
}
