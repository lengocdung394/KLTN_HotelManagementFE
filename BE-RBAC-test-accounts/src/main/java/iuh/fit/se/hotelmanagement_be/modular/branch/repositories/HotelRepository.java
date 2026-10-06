package iuh.fit.se.hotelmanagement_be.modular.branch.repositories;

import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface HotelRepository  extends JpaRepository<Hotel, Long> {
    boolean existsByName(String s);
    Optional<Hotel> findByName(String name);
    List<Hotel> findAllByProvince_Id(String provinceId);
}
